"use client";

import Link from "next/link";
import { useState } from "react";
import { ConflictDialog, STATUS_TEXT } from "./Account";
import { ChevronIcon, GoogleIcon } from "./icons";
import { useProgress } from "@/lib/progress";
import { ITEMS, countDone } from "@/lib/sheet";

const QUIET_ERRORS = new Set(["auth/popup-closed-by-user", "auth/cancelled-popup-request"]);

export default function AccountPage() {
  const { state, user, status, error, conflict, resolveConflict, cancelConflict, signIn, signOut } = useProgress();
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const doneHere = state ? countDone(state.done) : null;

  const handleSignIn = async () => {
    setBusy(true);
    setAuthError(null);
    try {
      await signIn();
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (!err.code || !QUIET_ERRORS.has(err.code)) setAuthError(err.message ?? "Sign-in failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    setBusy(true);
    try {
      await signOut();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="account-page">
      <Link href="/" className="back">
        <ChevronIcon className="back-icon" />
        Back to the sheet
      </Link>

      <h1>Account</h1>

      {!state ? (
        <div className="loading" aria-busy="true" />
      ) : user ? (
        <>
          <div className="profile">
            <span className="avatar" aria-hidden="true">
              {(user.displayName ?? user.email ?? "?").charAt(0).toUpperCase()}
            </span>
            <div className="profile-text">
              <strong>{user.displayName ?? "Signed in"}</strong>
              <span className="muted">{user.email}</span>
            </div>
          </div>

          <dl className="facts">
            <div>
              <dt>Sync</dt>
              <dd>
                <span className="sync-dot" data-status={status} aria-hidden="true" />
                {STATUS_TEXT[status]}
              </dd>
            </div>
            {error && (
              <div>
                <dt>Error</dt>
                <dd className="fact-error">{error}</dd>
              </div>
            )}
            <div>
              <dt>Progress</dt>
              <dd>
                {doneHere} of {ITEMS.length} done
                {status === "synced" && <span className="muted">, same on every signed-in device</span>}
              </dd>
            </div>
          </dl>

          <div className="account-actions">
            <button type="button" className="btn" onClick={handleSignOut} disabled={busy}>
              Sign out
            </button>
            <p className="muted">Signing out keeps your progress in this browser. It just stops syncing.</p>
          </div>
        </>
      ) : (
        <>
          <p className="lede">
            Signing in is optional. It keeps your progress in sync across devices and backs it up. Without it,
            progress is saved in this browser only.
          </p>

          <dl className="facts">
            <div>
              <dt>This browser</dt>
              <dd>
                {doneHere} of {ITEMS.length} done
              </dd>
            </div>
          </dl>

          <div className="account-actions">
            <button type="button" className="btn btn-google" onClick={handleSignIn} disabled={busy}>
              <GoogleIcon className="google-icon" />
              {busy ? "Signing in…" : "Continue with Google"}
            </button>
            {authError && <p className="fact-error">{authError}</p>}
          </div>

          <ul className="how">
            <li>New account: this browser&rsquo;s progress is uploaded to it. Nothing is erased.</li>
            <li>
              Account that already has progress: it&rsquo;s loaded. If this browser also has changes the account
              doesn&rsquo;t, you choose which to keep.
            </li>
          </ul>
        </>
      )}

      {conflict && <ConflictDialog conflict={conflict} onChoose={resolveConflict} onCancel={cancelConflict} />}
    </div>
  );
}
