import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
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
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  runTransaction,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  type Firestore,
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

function createOptimizedFirestore(firebaseApp: FirebaseApp): Firestore {
  if (typeof window !== "undefined") {
    try {
      return initializeFirestore(firebaseApp, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      });
    } catch {
      // Already initialized (e.g. Next.js fast refresh) or IndexedDB unavailable
      return getFirestore(firebaseApp);
    }
  }
  return getFirestore(firebaseApp);
}

export const db = app ? createOptimizedFirestore(app) : null;
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

export function watchRecord<T>(
  name: string,
  id: string,
  callback: (row: T | null) => void,
  onError?: (error: Error) => void,
) {
  if (!db) {
    callback(null);
    return () => undefined;
  }
  return onSnapshot(
    doc(db, name, id),
    (snapshot) => {
      callback(snapshot.exists() ? (snapshot.data() as T) : null);
    },
    (error) => {
      console.error(`Error watching "${name}/${id}":`, error);
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

export async function updateRecord(
  name: string,
  id: string,
  patch: Record<string, unknown>,
) {
  if (!db) return;
  await updateDoc(doc(db, name, id), stripUndefined(patch));
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
      batch.update(doc(db, "assets", asset.id), {
        custodianName: employee.name,
        custodianDepartment: employee.department,
      });
    }
    await batch.commit();
  }
}

function isPermissionDeniedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: unknown }).code ?? "").toLowerCase() : "";
  const message = "message" in error ? String((error as { message?: unknown }).message ?? "").toLowerCase() : "";
  return code.includes("permission-denied") || message.includes("missing or insufficient permissions");
}

// Session-cached mode avoids repeating failing network round-trips when /toners rules are not yet deployed
let tonerStorageMode: "unknown" | "collection" | "fallback" = "unknown";

export function markTonerCollectionRestricted() {
  tonerStorageMode = "fallback";
}

export function watchFallbackTonerStore<
  TToner extends { id: string },
  TTx extends { id: string },
>(
  onToners: (rows: TToner[]) => void,
  onTransactions: (rows: TTx[]) => void,
) {
  if (!db) return () => undefined;
  return onSnapshot(
    doc(db, "settings", "departments"),
    (snapshot) => {
      if (!snapshot.exists()) {
        onToners([]);
        onTransactions([]);
        return;
      }
      const data = snapshot.data();
      const toners = Array.isArray(data.toners) ? (data.toners as TToner[]) : [];
      const transactions = Array.isArray(data.tonerTransactions) ? (data.tonerTransactions as TTx[]) : [];
      onToners(toners);
      onTransactions(transactions);
    },
    (error) => {
      console.error("Error loading fallback toner store:", error);
    },
  );
}

async function saveTonerToFallbackDoc<TToner extends { id: string }>(clean: TToner) {
  if (!db) return;
  const fallbackRef = doc(db, "settings", "departments");
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(fallbackRef);
    const data = snap.exists() ? snap.data() : {};
    const existing = Array.isArray(data.toners) ? (data.toners as TToner[]) : [];
    const found = existing.some((row) => row.id === clean.id);
    const next = found
      ? existing.map((row) => (row.id === clean.id ? clean : row))
      : [clean, ...existing];
    tx.set(fallbackRef, { toners: next }, { merge: true });
  });
}

export async function saveTonerRecord<TToner extends { id: string }>(toner: TToner) {
  if (!db) return;
  const clean = stripUndefined(toner);
  if (tonerStorageMode === "fallback") {
    await saveTonerToFallbackDoc(clean);
    return;
  }
  try {
    await setDoc(doc(db, "toners", toner.id), clean);
    tonerStorageMode = "collection";
  } catch (err) {
    if (!isPermissionDeniedError(err)) throw err;
    tonerStorageMode = "fallback";
    await saveTonerToFallbackDoc(clean);
  }
}

export async function deleteTonerRecord(tonerId: string) {
  if (!db) return;
  if (tonerStorageMode !== "fallback") {
    try {
      await deleteDoc(doc(db, "toners", tonerId));
      tonerStorageMode = "collection";
    } catch (err) {
      if (!isPermissionDeniedError(err)) throw err;
      tonerStorageMode = "fallback";
    }
  }
  const fallbackRef = doc(db, "settings", "departments");
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(fallbackRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const existing = Array.isArray(data.toners) ? (data.toners as { id: string }[]) : [];
    if (!existing.some((row) => row.id === tonerId)) return;
    tx.set(
      fallbackRef,
      { toners: existing.filter((row) => row.id !== tonerId) },
      { merge: true },
    );
  });
}

export async function applyTonerStockTransaction<
  TToner extends { id: string; quantity: number; updatedAt: string },
  TTx extends { id: string; resultingStock: number },
  TMovement extends { id: string; assetId: string; type: string; date: string; createdAt?: string; note: string; employeeId: string; employeeName?: string; department?: string },
>(
  tonerFallback: TToner,
  mode: "Restock" | "Issued",
  quantity: number,
  buildTransaction: (resultingStock: number) => TTx,
  printerMovement?: TMovement,
): Promise<{ updatedToner: TToner; transaction: TTx; movement?: TMovement }> {
  const safeQty = Math.floor(Math.max(1, quantity));
  if (!db) {
    if (mode === "Issued" && safeQty > tonerFallback.quantity) {
      throw new Error(`Insufficient stock: only ${tonerFallback.quantity} unit(s) remaining.`);
    }
    const nextQty = mode === "Restock"
      ? tonerFallback.quantity + safeQty
      : Math.max(0, tonerFallback.quantity - safeQty);
    const updatedToner = { ...tonerFallback, quantity: nextQty };
    const transaction = buildTransaction(nextQty);
    return { updatedToner, transaction, movement: printerMovement };
  }

  const writePrinterMovement = (tx: Parameters<Parameters<typeof runTransaction>[1]>[0]) => {
    if (!printerMovement || !db) return;
    tx.set(doc(db, "movements", printerMovement.id), stripUndefined(printerMovement));
    tx.set(
      doc(db, "assets", printerMovement.assetId, "history", printerMovement.id),
      stripUndefined({
        id: printerMovement.id,
        type: printerMovement.type,
        date: printerMovement.date,
        createdAt: printerMovement.createdAt,
        note: printerMovement.note,
        employeeName: printerMovement.employeeName ?? "IT Administration",
        department: printerMovement.department ?? "Central Stock",
      }),
    );
  };

  const runFallbackTx = async () => {
    const fallbackRef = doc(db!, "settings", "departments");
    return await runTransaction(db!, async (tx) => {
      const snap = await tx.get(fallbackRef);
      const data = snap.exists() ? snap.data() : {};
      const existingToners = Array.isArray(data.toners) ? (data.toners as TToner[]) : [];
      const existingLogs = Array.isArray(data.tonerTransactions) ? (data.tonerTransactions as TTx[]) : [];
      const current = existingToners.find((row) => row.id === tonerFallback.id) ?? tonerFallback;
      if (mode === "Issued" && safeQty > current.quantity) {
        throw new Error(`Insufficient stock: only ${current.quantity} unit(s) remaining.`);
      }
      const nextQty = mode === "Restock"
        ? current.quantity + safeQty
        : Math.max(0, current.quantity - safeQty);
      const updatedToner: TToner = stripUndefined({ ...current, quantity: nextQty, updatedAt: tonerFallback.updatedAt });
      const transaction = stripUndefined(buildTransaction(nextQty));
      const nextToners = existingToners.some((row) => row.id === tonerFallback.id)
        ? existingToners.map((row) => (row.id === tonerFallback.id ? updatedToner : row))
        : [updatedToner, ...existingToners];
      const nextLogs = [transaction, ...existingLogs.filter((row) => row.id !== transaction.id)].slice(0, 500);
      tx.set(fallbackRef, { toners: nextToners, tonerTransactions: nextLogs }, { merge: true });
      writePrinterMovement(tx);
      return { updatedToner, transaction, movement: printerMovement };
    });
  };

  if (tonerStorageMode === "fallback") {
    return runFallbackTx();
  }

  try {
    const result = await runTransaction(db, async (tx) => {
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
      writePrinterMovement(tx);
      return { updatedToner, transaction, movement: printerMovement };
    });
    tonerStorageMode = "collection";
    return result;
  } catch (err) {
    if (!isPermissionDeniedError(err)) throw err;
    tonerStorageMode = "fallback";
    return runFallbackTx();
  }
}

export async function removeRecord(name: string, id: string) {
  if (!db) return;
  await deleteDoc(doc(db, name, id));
}

export async function deleteRecordsBatch(paths: [string, string, ...string[]][]) {
  if (!db || !paths.length) return;
  const CHUNK_SIZE = 400;
  for (let i = 0; i < paths.length; i += CHUNK_SIZE) {
    const batch = writeBatch(db);
    for (const [first, ...rest] of paths.slice(i, i + CHUNK_SIZE)) {
      batch.delete(doc(db, first, ...rest));
    }
    await batch.commit();
  }
}

export async function mergeDuplicateEmployeeRecord(
  keepEmployee: { id: string; name: string; department: string },
  duplicateEmployeeId: string,
  assetsToTransfer: { id: string; [key: string]: unknown }[],
  movementsToTransfer: { id: string; [key: string]: unknown }[],
) {
  if (!db) return;
  const CHUNK_SIZE = 350;
  for (let i = 0; i < assetsToTransfer.length; i += CHUNK_SIZE) {
    const batch = writeBatch(db);
    for (const asset of assetsToTransfer.slice(i, i + CHUNK_SIZE)) {
      batch.update(doc(db, "assets", asset.id), {
        employeeId: keepEmployee.id,
        custodianName: keepEmployee.name,
        custodianDepartment: keepEmployee.department,
      });
    }
    await batch.commit();
  }
  for (let i = 0; i < movementsToTransfer.length; i += CHUNK_SIZE) {
    const batch = writeBatch(db);
    for (const movement of movementsToTransfer.slice(i, i + CHUNK_SIZE)) {
      batch.update(doc(db, "movements", movement.id), {
        employeeId: keepEmployee.id,
        employeeName: keepEmployee.name,
        department: keepEmployee.department,
      });
    }
    await batch.commit();
  }
  await deleteDoc(doc(db, "employees", duplicateEmployeeId));
}

export async function listRecords<T extends { id: string }>(name: string) {
  if (!db) return [];
  const snapshot = await getDocs(collection(db, name));
  return snapshot.docs.map((item) => item.data() as T);
}

export async function deleteAssetRecord(assetId: string, movementIds: string[]) {
  if (!db) return;
  // Chunk movement/history deletes (200 movements = 400 ops) so assets with large history never hit the 500-op batch cap
  const CHUNK_SIZE = 200;
  for (let i = 0; i < movementIds.length; i += CHUNK_SIZE) {
    const batch = writeBatch(db);
    for (const movementId of movementIds.slice(i, i + CHUNK_SIZE)) {
      batch.delete(doc(db, "movements", movementId));
      batch.delete(doc(db, "assets", assetId, "history", movementId));
    }
    if (i + CHUNK_SIZE >= movementIds.length) {
      batch.delete(doc(db, "assets", assetId));
    }
    await batch.commit();
  }
  if (!movementIds.length) {
    await deleteDoc(doc(db, "assets", assetId));
  }
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

function cleanStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim())
    : [];
}

function toInputDate(value: unknown): string {
  return value instanceof Timestamp
    ? value.toDate().toISOString().slice(0, 16)
    : String(value ?? "");
}

export async function getRequirementWindow() {
  if (!db) return DEFAULT_REQUIREMENT_WINDOW;
  const windowRef = doc(db, "settings", "requirement-window");
  const snapshot = await getDoc(windowRef);
  if (!snapshot.exists()) return DEFAULT_REQUIREMENT_WINDOW;
  const data = snapshot.data();
  const currentDepartments = cleanStringList(data.departments);
  let departments = currentDepartments;

  // Only read legacy settings/departments when departments are not yet migrated (saves 1 GET on every load)
  if (!currentDepartments.length) {
    const legacySnapshot = await getDoc(doc(db, "settings", "departments"));
    const legacyDepartments = cleanStringList(legacySnapshot.data()?.items);
    departments = legacyDepartments;
    if (legacyDepartments.length && isAdminEmail(auth?.currentUser?.email)) {
      await runTransaction(db, async (transaction) => {
        const latestSnapshot = await transaction.get(windowRef);
        const latestDepartments = cleanStringList(latestSnapshot.data()?.departments);
        if (!latestDepartments.length) {
          transaction.set(windowRef, { departments: legacyDepartments }, { merge: true });
        }
      });
    }
  }

  const locations = cleanStringList(data.locations);
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
    const departments = cleanStringList(data.departments);
    const locations = cleanStringList(data.locations);
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
