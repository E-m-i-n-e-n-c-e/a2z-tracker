"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { User } from "@/lib/cloud";
import { type Conflict, type ConflictChoice, type SyncStatus } from "@/lib/progress";
import { countDone } from "@/lib/sheet";

export const STATUS_TEXT: Record<SyncStatus, string> = {
  "signed-out": "Not signed in",
  checking: "Checking your account…",
  conflict: "Waiting for you to choose which progress to keep",
  synced: "Synced",
  error: "Sync failed",
};

/** Small entry point in the rail: only navigates to the account page. */
export function AccountLink({ user, status }: { user: User | null; status: SyncStatus }) {
  const name = user ? (user.displayName?.split(" ")[0] ?? user.email ?? "Account") : "Sign in";
  return (
    <Link href="/account" className="account-link" title={user ? `${STATUS_TEXT[status]}. Account settings` : undefined}>
      {user && <span className="sync-dot" data-status={status} aria-hidden="true" />}
      {name}
    </Link>
  );
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export function ConflictDialog({
  conflict,
  onChoose,
  onCancel,
}: {
  conflict: Conflict;
  onChoose: (choice: ConflictChoice) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const inCloud = countDone(conflict.cloud.done);
  const here = countDone(conflict.local.done);
  const merged = countDone({ ...conflict.cloud.done, ...conflict.local.done });

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="conflict-title"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <h2 id="conflict-title">This account already has progress</h2>
      <p className="muted">Your account and this browser have different questions ticked. Pick which one to keep.</p>

      <div className="choices">
        <button type="button" className="choice" onClick={() => onChoose("cloud")}>
          <strong>Use account progress</strong>
          <span>
            {inCloud} done, last updated {fmt(conflict.cloud.updatedAt)}. This browser&rsquo;s {here} will be
            replaced.
          </span>
        </button>
        <button type="button" className="choice" onClick={() => onChoose("local")}>
          <strong>Use this browser&rsquo;s progress</strong>
          <span>
            {here} done. The account&rsquo;s {inCloud} will be overwritten.
          </span>
        </button>
        <button type="button" className="choice" onClick={() => onChoose("merge")}>
          <strong>Merge both</strong>
          <span>Anything done in either is kept done: {merged} in total. Nothing is lost.</span>
        </button>
      </div>

      <button type="button" className="link" onClick={onCancel}>
        Cancel and stay signed out
      </button>
    </dialog>
  );
}
