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

const getEnv = (val?: string, fallback: string = "") => (val && val.trim() ? val.trim() : fallback);

const firebaseConfig = {
  apiKey: getEnv(process.env.NEXT_PUBLIC_FIREBASE_API_KEY, "AIzaSyCvhe9yXEVN1SSalm49ntrJQgvpY2KZ0EI"),
  authDomain: getEnv(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, "scot-inventory.firebaseapp.com"),
  projectId: getEnv(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, "scot-inventory"),
  storageBucket: getEnv(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, "scot-inventory.firebasestorage.app"),
  messagingSenderId: getEnv(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, "380358714447"),
  appId: getEnv(process.env.NEXT_PUBLIC_FIREBASE_APP_ID, "1:380358714447:web:638d7860ea904ce068763a"),
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
  "shanaka@scot.lk",
  "shamila@scot.lk",
  "niroshan@scot.lk",
  "musthaque@scot.lk",
  "yohan@scot.lk",
  "hr@scot.lk",
  "sheran@scot.lk",
  "disithar@gmail.com",
] as const;

export function isAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  return (
    clean.endsWith("@scot.lk") ||
    clean === "disithar@gmail.com" ||
    ADMIN_EMAILS.some((adminEmail) => adminEmail === clean)
  );
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
  onError?: (error: Error) => void,
) {
  if (!db) return () => undefined;
  return onSnapshot(
    collection(db, name),
    (snapshot) => {
      callback(snapshot.docs.map((item) => item.data() as T));
    },
    (error) => {
      console.error(`Error loading collection "${name}":`, error);
      onError?.(error);
    },
  );
}

function stripUndefined<T>(item: T): T {
  if (Array.isArray(item)) return item.map(stripUndefined) as T;
  if (item && typeof item === "object") {
    return Object.fromEntries(
      Object.entries(item as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, stripUndefined(entry)]),
    ) as T;
  }
  return item;
}

export async function saveRecord<T extends { id: string }>(
  name: string,
  value: T,
) {
  if (!db) return;
  await setDoc(doc(db, name, value.id), stripUndefined(value));
}

export async function commitAssetMovementsBatch(
  items: {
    asset: { id: string; [key: string]: unknown };
    movement: { id: string; assetId: string; type: string; date: string; createdAt?: string; note: string; employeeId: string; employeeName?: string; department?: string };
  }[],
) {
  if (!db || !items.length) return;
  // Each item writes 3 docs (asset + movement + asset/history); keep each batch well below Firestore's 500-op limit
  const CHUNK_SIZE = 150;
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const batch = writeBatch(db);
    for (const { asset, movement } of items.slice(i, i + CHUNK_SIZE)) {
      batch.set(doc(db, "assets", asset.id), stripUndefined(asset));
      batch.set(doc(db, "movements", movement.id), stripUndefined(movement));
      batch.set(
        doc(db, "assets", movement.assetId, "history", movement.id),
        stripUndefined({
          id: movement.id,
          type: movement.type,
          date: movement.date,
          createdAt: movement.createdAt,
          note: movement.note,
          employeeName: movement.employeeName ?? "Asset Administration",
          department: movement.department ?? "Central Stock",
        }),
      );
    }
    await batch.commit();
  }
}

export async function syncEmployeeCustodianOnAssets(
  employee: { id: string; name: string; department: string },
  assignedAssets: { id: string; [key: string]: unknown }[],
) {
  if (!db || !assignedAssets.length) return;
  const CHUNK_SIZE = 400;
  for (let i = 0; i < assignedAssets.length; i += CHUNK_SIZE) {
    const batch = writeBatch(db);
    for (const asset of assignedAssets.slice(i, i + CHUNK_SIZE)) {
      batch.set(
        doc(db, "assets", asset.id),
        stripUndefined({
          ...asset,
          custodianName: employee.name,
          custodianDepartment: employee.department,
        }),
      );
    }
    await batch.commit();
  }
}

export async function applyTonerStockTransaction<
  TToner extends { id: string; quantity: number; updatedAt: string },
  TTx extends { id: string; resultingStock: number },
>(
  tonerFallback: TToner,
  mode: "Restock" | "Issued",
  quantity: number,
  buildTransaction: (resultingStock: number) => TTx,
): Promise<{ updatedToner: TToner; transaction: TTx }> {
  const safeQty = Math.floor(Math.max(1, quantity));
  if (!db) {
    const nextQty = mode === "Restock"
      ? tonerFallback.quantity + safeQty
      : Math.max(0, tonerFallback.quantity - safeQty);
    const updatedToner = { ...tonerFallback, quantity: nextQty };
    const transaction = buildTransaction(nextQty);
    return { updatedToner, transaction };
  }

  return runTransaction(db, async (tx) => {
    const tonerRef = doc(db, "toners", tonerFallback.id);
    const snap = await tx.get(tonerRef);
    const current = snap.exists() ? (snap.data() as TToner) : tonerFallback;
    if (mode === "Issued" && safeQty > current.quantity) {
      throw new Error(`Insufficient stock: only ${current.quantity} unit(s) remaining.`);
    }
    const nextQty = mode === "Restock"
      ? current.quantity + safeQty
      : Math.max(0, current.quantity - safeQty);
    const updatedToner: TToner = { ...current, quantity: nextQty, updatedAt: tonerFallback.updatedAt };
    const transaction = buildTransaction(nextQty);
    tx.set(tonerRef, stripUndefined(updatedToner));
    tx.set(doc(db, "tonerTransactions", transaction.id), stripUndefined(transaction));
    return { updatedToner, transaction };
  });
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
  locations?: string[];
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
  const locations = cleanDepartments(data.locations);

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
    ...(locations.length ? { locations } : {}),
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
    const cleanList = (value: unknown) =>
      Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim())
        : [];
    const departments = cleanList(data.departments);
    const locations = cleanList(data.locations);
    callback({
      ...data,
      id: "requirement-window",
      opensAt: toInputDate(data.opensAt),
      closesAt: toInputDate(data.closesAt),
      ...(departments.length ? { departments } : {}),
      ...(locations.length ? { locations } : {}),
    } as RequirementWindowRecord);
  });
}

export async function saveRequirementWindow(value: RequirementWindowRecord) {
  if (!db) return;
  const opensDate = new Date(value.opensAt || DEFAULT_REQUIREMENT_WINDOW.opensAt);
  const closesDate = new Date(value.closesAt || DEFAULT_REQUIREMENT_WINDOW.closesAt);
  const safeOpens = Number.isNaN(opensDate.getTime()) ? new Date(DEFAULT_REQUIREMENT_WINDOW.opensAt) : opensDate;
  const safeCloses = Number.isNaN(closesDate.getTime()) ? new Date(DEFAULT_REQUIREMENT_WINDOW.closesAt) : closesDate;
  const cleaned = Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  );
  await setDoc(doc(db, "settings", "requirement-window"), {
    ...cleaned,
    opensAt: Timestamp.fromDate(safeOpens),
    closesAt: Timestamp.fromDate(safeCloses),
  });
}
