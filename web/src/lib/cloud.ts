"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  type User,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut as fbSignOut,
} from "firebase/auth";
import {
  doc,
  getDoc,
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  setDoc,
} from "firebase/firestore";
import type { ProgressState } from "./progress";

// Public web config: it identifies the project, it doesn't grant access. firestore.rules does that.
const config = {
  apiKey: "AIzaSyCPFD1ekrdYLUERDb5UVqHQ3pMlmBPzYtI",
  authDomain: "striver-sheet.firebaseapp.com",
  projectId: "striver-sheet",
  storageBucket: "striver-sheet.firebasestorage.app",
  messagingSenderId: "835471733066",
  appId: "1:835471733066:web:f2625072c103d7de0611b3",
};

const app = getApps().length ? getApp() : initializeApp(config);
const auth = getAuth(app);
// Offline cache (IndexedDB) keeps unsent writes across reloads; the server render has no IndexedDB.
function initDb() {
  try {
    return initializeFirestore(app, {
      localCache:
        typeof window === "undefined"
          ? memoryLocalCache()
          : persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    // Already initialised (hot reload re-runs this module); reuse that instance.
    return getFirestore(app);
  }
}

const db = initDb();

const userDoc = (uid: string) => doc(db, "users", uid);

export type { User };

export const watchUser = (cb: (user: User | null) => void) => onAuthStateChanged(auth, cb);

export const signIn = () => signInWithPopup(auth, new GoogleAuthProvider());

export const signOut = () => fbSignOut(auth);

export async function fetchCloud(uid: string): Promise<ProgressState | null> {
  const snap = await getDoc(userDoc(uid));
  return snap.exists() ? (snap.data() as ProgressState) : null;
}

export const pushCloud = (uid: string, state: ProgressState) =>
  setDoc(userDoc(uid), { done: state.done, updatedAt: state.updatedAt });

/** Calls back with confirmed server state (skips this tab's own pending writes). */
export const watchCloud = (uid: string, cb: (state: ProgressState) => void) =>
  onSnapshot(userDoc(uid), (snap) => {
    if (snap.exists() && !snap.metadata.hasPendingWrites) cb(snap.data() as ProgressState);
  });
