import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { getFirebaseDb } from "../../lib/firebase";
import type { CreateWorkEntryPayload, WorkEntry } from "./types";

/** Хто дивиться список: лише admin отримує повну вибірку; employee — завжди лише свої записи. */
export type WorkEntriesViewer = { uid: string; role: "admin" | "employee" };

/**
 * Єдиний вхід для екранів «Роботи»: не покладайтеся лише на UI — employee ніколи не викликає повний список.
 */
export async function listWorkEntriesForViewer(viewer: WorkEntriesViewer): Promise<WorkEntry[]> {
  if (viewer.role !== "admin") {
    return listUserWorkEntries(viewer.uid);
  }
  return listAllWorkEntries();
}

export async function createWorkEntry(payload: CreateWorkEntryPayload): Promise<void> {
  const db = getFirebaseDb();
  const workEntriesCollection = collection(db, "workEntries");
  await addDoc(workEntriesCollection, {
    ...payload,
    amount: payload.amount ?? 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function listUserWorkEntries(userId: string): Promise<WorkEntry[]> {
  const db = getFirebaseDb();
  const workEntriesCollection = collection(db, "workEntries");
  const snapshot = await getDocs(query(workEntriesCollection, where("userId", "==", userId)));

  return snapshot.docs
    .map((item) => ({ id: item.id, ...(item.data() as Omit<WorkEntry, "id">) }))
    .sort((a, b) => b.workDate.localeCompare(a.workDate));
}

export async function listAllWorkEntries(): Promise<WorkEntry[]> {
  const db = getFirebaseDb();
  const workEntriesCollection = collection(db, "workEntries");
  const snapshot = await getDocs(query(workEntriesCollection, orderBy("workDate", "desc")));
  return snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<WorkEntry, "id">) }));
}

export async function updateWorkEntryAdmin(
  workId: string,
  patch: {
    amount: number;
    description: string;
    workDate?: string;
    categoryId?: string;
    categoryName?: string;
  },
): Promise<void> {
  const db = getFirebaseDb();
  const updates: Record<string, unknown> = {
    amount: patch.amount,
    description: patch.description,
    updatedAt: serverTimestamp(),
  };
  if (patch.workDate !== undefined) updates.workDate = patch.workDate;
  if (patch.categoryId !== undefined) updates.categoryId = patch.categoryId;
  if (patch.categoryName !== undefined) updates.categoryName = patch.categoryName;
  await updateDoc(doc(db, "workEntries", workId), updates);
}

export async function deleteWorkEntryAdmin(workId: string): Promise<void> {
  const db = getFirebaseDb();
  await deleteDoc(doc(db, "workEntries", workId));
}

