import { addDoc, collection, doc, getDocs, orderBy, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { getFirebaseDb } from "../../lib/firebase";
import type { CreateWorkEntryPayload, WorkEntry } from "./types";

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

export async function updateWorkEntryAdmin(workId: string, patch: { amount: number; description: string }): Promise<void> {
  const db = getFirebaseDb();
  await updateDoc(doc(db, "workEntries", workId), {
    amount: patch.amount,
    description: patch.description,
    updatedAt: serverTimestamp(),
  });
}

