import { getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  setDoc,
  Timestamp,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyCvhe9yXEVN1SSalm49ntrJQgvpY2KZ0EI",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "scot-inventory.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "scot-inventory",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "scot-inventory.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "380358714447",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:380358714447:web:638d7860ea904ce068763a",
};

export const firebaseReady = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId,
);

const app = firebaseReady
  ? getApps()[0] ?? initializeApp(firebaseConfig)
  : null;

export const db = app ? getFirestore(app) : null;
export const auth = app ? getAuth(app) : null;
export const ADMIN_EMAIL = "it@scot.lk";

export function watchAuth(callback: (user: User | null) => void) {
  if (!auth) {
    callback(null);
    return () => undefined;
  }
  return onAuthStateChanged(auth, callback);
}

export async function signInAsAdmin() {
  if (!auth) throw new Error("Firebase is not configured.");
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ login_hint: ADMIN_EMAIL, prompt: "select_account" });
  return signInWithPopup(auth, provider);
}

export async function signOutAdmin() {
  if (auth) await signOut(auth);
}

export function watchCollection<T extends { id: string }>(
  name: string,
  callback: (rows: T[]) => void,
) {
  if (!db) return () => undefined;
  return onSnapshot(collection(db, name), (snapshot) => {
    callback(snapshot.docs.map((item) => item.data() as T));
  });
}

export async function saveRecord<T extends { id: string }>(
  name: string,
  value: T,
) {
  if (!db) return;
  await setDoc(doc(db, name, value.id), value);
}

export async function removeRecord(name: string, id: string) {
  if (!db) return;
  await deleteDoc(doc(db, name, id));
}

export async function getRecord<T>(name: string, id: string) {
  if (!db) return null;
  const snapshot = await getDoc(doc(db, name, id));
  return snapshot.exists() ? (snapshot.data() as T) : null;
}

export type RequirementWindowRecord = {
  id: "requirement-window";
  title: string;
  slug: string;
  opensAt: string;
  closesAt: string;
  isOpen: boolean;
  periodLabel: string;
  departments?: string[];
};

export const DEFAULT_REQUIREMENT_WINDOW: RequirementWindowRecord = {
  id: "requirement-window",
  title: "Next department requirements",
  slug: "next-requirements",
  opensAt: "2026-07-29T08:00",
  closesAt: "2026-08-31T17:00",
  isOpen: false,
  periodLabel: "Next planning period",
};

export async function getRequirementWindow() {
  if (!db) return DEFAULT_REQUIREMENT_WINDOW;
  const snapshot = await getDoc(doc(db, "settings", "requirement-window"));
  if (!snapshot.exists()) return DEFAULT_REQUIREMENT_WINDOW;
  const data = snapshot.data();
  const toInputDate = (value: unknown) =>
    value instanceof Timestamp
      ? value.toDate().toISOString().slice(0, 16)
      : String(value ?? "");
  return {
    ...data,
    id: "requirement-window",
    opensAt: toInputDate(data.opensAt),
    closesAt: toInputDate(data.closesAt),
  } as RequirementWindowRecord;
}

export async function saveRequirementWindow(value: RequirementWindowRecord) {
  if (!db) return;
  await setDoc(doc(db, "settings", "requirement-window"), {
    ...value,
    opensAt: Timestamp.fromDate(new Date(value.opensAt)),
    closesAt: Timestamp.fromDate(new Date(value.closesAt)),
  });
}
