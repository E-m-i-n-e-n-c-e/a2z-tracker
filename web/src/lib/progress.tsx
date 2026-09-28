"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { type User, fetchCloud, pushCloud, signIn, signOut, watchCloud, watchUser } from "./cloud";

export interface ProgressState {
  /** item id -> ISO time it was ticked here, or null if it was restored from takeUforward */
  done: Record<string, string | null>;
  updatedAt: string;
}

const KEY = "a2z-progress-v1";
/**
 * Sync bookkeeping for this browser:
 * - uid: the account this browser's progress was last matched with.
 * - editedOffline: progress changed while not syncing to that account.
 * Only when both sides may have changed (offline edits, or a different account) is the user asked to choose.
 */
const META_KEY = "a2z-sync-meta-v2";

interface SyncMeta {
  uid: string | null;
  editedOffline: boolean;
}

function loadLocal(): ProgressState | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ProgressState) : null;
  } catch {
    return null;
  }
}

function saveLocal(state: ProgressState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked; progress stays in memory for this visit.
  }
}

function readMeta(): SyncMeta {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (raw) return JSON.parse(raw) as SyncMeta;
  } catch {}
  return { uid: null, editedOffline: false };
}

function writeMeta(meta: SyncMeta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {}
}

export function emptyState(): ProgressState {
  return { done: {}, updatedAt: new Date().toISOString() };
}

export function isProgressState(value: unknown): value is ProgressState {
  if (!value || typeof value !== "object") return false;
  const done = (value as ProgressState).done;
  return !!done && typeof done === "object" && !Array.isArray(done);
}

function sameDone(a: ProgressState, b: ProgressState) {
  const ak = Object.keys(a.done);
  return ak.length === Object.keys(b.done).length && ak.every((k) => k in b.done);
}

export type SyncStatus = "signed-out" | "checking" | "conflict" | "synced" | "error";
export type ConflictChoice = "cloud" | "local" | "merge";

export interface Conflict {
  cloud: ProgressState;
  local: ProgressState;
}

function useProgressSync() {
  const [state, setState] = useState<ProgressState | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [linkedUid, setLinkedUid] = useState<string | null>(null);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stateRef = useRef(state);
  const linked = useRef<string | null>(null);
  // updatedAt of the last version that came from the cloud; don't write it straight back.
  const fromCloud = useRef<string | null>(null);
  const resolver = useRef<((choice: ConflictChoice) => void) | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    // Deferred so the first client render matches the server (no progress yet).
    Promise.resolve().then(() => setState(loadLocal() ?? emptyState()));
  }, []);

  useEffect(() => watchUser(setUser), []);

  const loaded = state !== null;
  const uid = user?.uid ?? null;

  // Link this browser to the signed-in account.
  useEffect(() => {
    if (!uid || !loaded) return;
    let cancelled = false;
    let unsub: (() => void) | undefined;

    const adopt = (remote: ProgressState) => {
      fromCloud.current = remote.updatedAt;
      setState(remote);
    };

    const start = () => {
      linked.current = uid;
      writeMeta({ uid, editedOffline: false });
      setLinkedUid(uid);
      setError(null);
      // Other devices' changes. This tab's own writes arrive with pending writes and are skipped in watchCloud.
      unsub = watchCloud(uid, (remote) => {
        const local = stateRef.current;
        if (local && remote.updatedAt !== local.updatedAt && remote.updatedAt > local.updatedAt) adopt(remote);
      });
    };

    (async () => {
      const cloud = await fetchCloud(uid);
      if (cancelled) return;
      const local = stateRef.current!;
      const meta = readMeta();
      const localIsCurrent = meta.uid === uid && !meta.editedOffline;

      if (!cloud) {
        // New account: it gets this browser's progress. Nothing is erased.
        start();
        await pushCloud(uid, local);
      } else if (sameDone(cloud, local) || localIsCurrent) {
        adopt(cloud);
        start();
      } else {
        resolver.current = (choice) => {
          setConflict(null);
          if (cancelled) return;
          start();
          if (choice === "cloud") {
            adopt(cloud);
          } else {
            const done = choice === "merge" ? { ...cloud.done, ...local.done } : local.done;
            setState({ done, updatedAt: new Date().toISOString() });
          }
        };
        setConflict({ cloud, local });
      }
    })().catch((e) => {
      if (!cancelled) setError(e instanceof Error ? e.message : String(e));
    });

    return () => {
      cancelled = true;
      unsub?.();
      linked.current = null;
      resolver.current = null;
      setLinkedUid(null);
      setConflict(null);
    };
  }, [uid, loaded]);

  // Every change: save locally, and write to the account right away when linked.
  // Firestore's offline cache holds the write if the network is slow or the page closes.
  useEffect(() => {
    if (!state) return;
    saveLocal(state);
    const target = linked.current;
    if (!target || state.updatedAt === fromCloud.current) return;
    pushCloud(target, state).then(
      () => setError(null),
      (e) => setError(e instanceof Error ? e.message : String(e)),
    );
  }, [state]);

  const markEdited = useCallback(() => {
    if (!linked.current) writeMeta({ ...readMeta(), editedOffline: true });
  }, []);

  const toggle = useCallback((id: number) => {
    markEdited();
    setState((prev) => {
      if (!prev) return prev;
      const done = { ...prev.done };
      if (String(id) in done) delete done[id];
      else done[id] = new Date().toISOString();
      return { done, updatedAt: new Date().toISOString() };
    });
  }, [markEdited]);

  const replace = useCallback((next: Pick<ProgressState, "done">) => {
    markEdited();
    setState({ done: next.done, updatedAt: new Date().toISOString() });
  }, [markEdited]);

  const resolveConflict = useCallback((choice: ConflictChoice) => resolver.current?.(choice), []);

  /** Backing out of the choice signs out again; this browser's progress is untouched. */
  const cancelConflict = useCallback(() => {
    setConflict(null);
    signOut();
  }, []);

  const status: SyncStatus = !user
    ? "signed-out"
    : error
      ? "error"
      : conflict
        ? "conflict"
        : linkedUid === user.uid
          ? "synced"
          : "checking";

  return { state, toggle, replace, user, status, error, conflict, resolveConflict, cancelConflict, signIn, signOut };
}

type ProgressApi = ReturnType<typeof useProgressSync>;

const ProgressContext = createContext<ProgressApi | null>(null);

/** One sync for the whole app, so moving between pages never re-links or drops a write. */
export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const api = useProgressSync();
  return <ProgressContext.Provider value={api}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressApi {
  const api = useContext(ProgressContext);
  if (!api) throw new Error("useProgress must be used inside ProgressProvider");
  return api;
}
