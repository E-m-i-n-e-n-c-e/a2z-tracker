"use client";

import { useCallback, useEffect, useState } from "react";
import { SNAPSHOT_DONE } from "./sheet";

export interface ProgressState {
  /** item id -> ISO time it was ticked here, or null if it came from the takeUforward snapshot */
  done: Record<string, string | null>;
  updatedAt: string;
}

/**
 * Where progress lives. Async so a Firestore-backed store can drop in later
 * (e.g. load = getDoc(users/{uid}), save = setDoc(...)) without UI changes.
 */
export interface ProgressStore {
  load(): Promise<ProgressState | null>;
  save(state: ProgressState): Promise<void>;
}

const KEY = "a2z-progress-v1";

export const localStore: ProgressStore = {
  async load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as ProgressState) : null;
    } catch {
      return null;
    }
  },
  async save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // Storage full or blocked; progress stays in memory for this visit.
    }
  },
};

export function snapshotState(): ProgressState {
  return {
    done: Object.fromEntries(SNAPSHOT_DONE.map((id) => [String(id), null])),
    updatedAt: new Date().toISOString(),
  };
}

export function isProgressState(value: unknown): value is ProgressState {
  if (!value || typeof value !== "object") return false;
  const done = (value as ProgressState).done;
  return !!done && typeof done === "object" && !Array.isArray(done);
}

export function useProgress(store: ProgressStore = localStore) {
  const [state, setState] = useState<ProgressState | null>(null);

  useEffect(() => {
    let alive = true;
    store.load().then((saved) => {
      if (alive) setState(saved ?? snapshotState());
    });
    return () => {
      alive = false;
    };
  }, [store]);

  useEffect(() => {
    if (state) store.save(state);
  }, [state, store]);

  const toggle = useCallback((id: number) => {
    setState((prev) => {
      if (!prev) return prev;
      const done = { ...prev.done };
      if (String(id) in done) delete done[id];
      else done[id] = new Date().toISOString();
      return { done, updatedAt: new Date().toISOString() };
    });
  }, []);

  const replace = useCallback((next: ProgressState) => {
    setState({ done: next.done, updatedAt: new Date().toISOString() });
  }, []);

  return { state, toggle, replace };
}
