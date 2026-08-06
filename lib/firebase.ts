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
  getDocs,
  getFirestore,
  onSnapshot,
  runTransaction,
  setDoc,
  Timestamp,
  writeBatch,
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
export const ADMIN_EMAILS = [
  ADMIN_EMAIL,
  "admin@scot.lk",
  "nimantha@scot.lk",
  "duminda@scot.lk",
  "shanka@scot.lk",
  "shamila@scot.lk",
  "yohan@scot.lk",
  "hr@scot.lk",
  "sheran@scot.lk",
] as const;

export function isAdminEmail(email: string | null | undefined) {
  return ADMIN_EMAILS.some((adminEmail) => adminEmail === email?.trim().toLowerCase());
}

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
  const withoutUndefined = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(withoutUndefined);
    if (item && typeof item === "object") {
      return Object.fromEntries(
        Object.entries(item)
          .filter(([, entry]) => entry !== undefined)
          .map(([key, entry]) => [key, withoutUndefined(entry)]),
      );
    }
    return item;
  };
  await setDoc(doc(db, name, value.id), withoutUndefined(value));
}

export async function removeRecord(name: string, id: string) {
  if (!db) return;
  await deleteDoc(doc(db, name, id));
}

export async function listRecords<T extends { id: string }>(name: string) {
  if (!db) return [];
  const snapshot = await getDocs(collection(db, name));
  return snapshot.docs.map((item) => item.data() as T);
}

export async function deleteAssetRecord(assetId: string, movementIds: string[]) {
  if (!db) return;
  if (movementIds.length > 249) {
    throw new Error("This asset has too many lifecycle records to delete in one operation.");
  }
  const batch = writeBatch(db);
  batch.delete(doc(db, "assets", assetId));
  movementIds.forEach((movementId) => {
    batch.delete(doc(db, "movements", movementId));
    batch.delete(doc(db, "assets", assetId, "history", movementId));
  });
  await batch.commit();
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
  const windowRef = doc(db, "settings", "requirement-window");
  const legacyDepartmentsRef = doc(db, "settings", "departments");
  const [snapshot, legacySnapshot] = await Promise.all([
    getDoc(windowRef),
    getDoc(legacyDepartmentsRef),
  ]);
  if (!snapshot.exists()) return DEFAULT_REQUIREMENT_WINDOW;
  const data = snapshot.data();
  const cleanDepartments = (value: unknown) =>
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim())
      : [];
  const currentDepartments = cleanDepartments(data.departments);
  const legacyDepartments = cleanDepartments(legacySnapshot.data()?.items);
  const departments = currentDepartments.length ? currentDepartments : legacyDepartments;

  // Recheck inside the transaction so legacy data cannot overwrite a newer list.
  if (!currentDepartments.length && legacyDepartments.length && isAdminEmail(auth?.currentUser?.email)) {
    await runTransaction(db, async (transaction) => {
      const latestSnapshot = await transaction.get(windowRef);
      const latestDepartments = cleanDepartments(latestSnapshot.data()?.departments);
      if (!latestDepartments.length) {
        transaction.set(windowRef, { departments: legacyDepartments }, { merge: true });
      }
    });
  }

  const toInputDate = (value: unknown) =>
    value instanceof Timestamp
      ? value.toDate().toISOString().slice(0, 16)
      : String(value ?? "");
  return {
    ...data,
    id: "requirement-window",
    opensAt: toInputDate(data.opensAt),
    closesAt: toInputDate(data.closesAt),
    ...(departments.length ? { departments } : {}),
  } as RequirementWindowRecord;
}

export function watchRequirementWindow(callback: (value: RequirementWindowRecord) => void) {
  if (!db) {
    callback(DEFAULT_REQUIREMENT_WINDOW);
    return () => undefined;
  }
  return onSnapshot(doc(db, "settings", "requirement-window"), (snapshot) => {
    if (!snapshot.exists()) {
      callback(DEFAULT_REQUIREMENT_WINDOW);
      return;
    }
    const data = snapshot.data();
    const toInputDate = (value: unknown) =>
      value instanceof Timestamp
        ? value.toDate().toISOString().slice(0, 16)
        : String(value ?? "");
    callback({
      ...data,
      id: "requirement-window",
      opensAt: toInputDate(data.opensAt),
      closesAt: toInputDate(data.closesAt),
    } as RequirementWindowRecord);
  });
}

export async function saveRequirementWindow(value: RequirementWindowRecord) {
  if (!db) return;
  await setDoc(doc(db, "settings", "requirement-window"), {
    ...value,
    opensAt: Timestamp.fromDate(new Date(value.opensAt)),
    closesAt: Timestamp.fromDate(new Date(value.closesAt)),
  });
}
