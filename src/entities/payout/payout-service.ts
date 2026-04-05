import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { getFirebaseDb } from "../../lib/firebase";
import type { CreateSalaryPayoutPayload, SalaryPayout } from "./types";

export async function createSalaryPayout(payload: CreateSalaryPayoutPayload): Promise<void> {
  const db = getFirebaseDb();
  const salaryPayoutsCollection = collection(db, "salaryPayouts");
  await addDoc(salaryPayoutsCollection, {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function listUserSalaryPayouts(userId: string): Promise<SalaryPayout[]> {
  const db = getFirebaseDb();
  const salaryPayoutsCollection = collection(db, "salaryPayouts");
  const snapshot = await getDocs(query(salaryPayoutsCollection, where("userId", "==", userId)));

  return snapshot.docs
    .map((item) => ({ id: item.id, ...(item.data() as Omit<SalaryPayout, "id">) }))
    .sort((a, b) => b.payoutDate.localeCompare(a.payoutDate));
}

export async function listAllSalaryPayouts(): Promise<SalaryPayout[]> {
  const db = getFirebaseDb();
  const salaryPayoutsCollection = collection(db, "salaryPayouts");
  const snapshot = await getDocs(query(salaryPayoutsCollection, orderBy("payoutDate", "desc")));

  return snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<SalaryPayout, "id">) }));
}

export async function deleteSalaryPayoutAdmin(payoutId: string): Promise<void> {
  const db = getFirebaseDb();
  await deleteDoc(doc(db, "salaryPayouts", payoutId));
}

export async function updateSalaryPayout(
  payoutId: string,
  patch: { payoutDate: string; description: string; amount: number },
): Promise<void> {
  const db = getFirebaseDb();
  await updateDoc(doc(db, "salaryPayouts", payoutId), {
    payoutDate: patch.payoutDate,
    description: patch.description,
    amount: patch.amount,
    updatedAt: serverTimestamp(),
  });
}

