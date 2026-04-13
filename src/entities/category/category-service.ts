import { addDoc, collection, getDocs, orderBy, query, serverTimestamp, where } from "firebase/firestore";
import { getFirebaseDb } from "../../lib/firebase";
import type { Category } from "./types";

export async function listCategories(companyId: string): Promise<Category[]> {
  const db = getFirebaseDb();
  const categoriesCollection = collection(db, "categories");
  const snapshot = await getDocs(
    query(categoriesCollection, where("companyId", "==", companyId), orderBy("name", "asc")),
  );

  return snapshot.docs.map((item) => ({
    id: item.id,
    name: item.data().name as string,
  }));
}

export async function addCategory(name: string, adminUid: string, companyId: string): Promise<void> {
  const db = getFirebaseDb();
  const categoriesCollection = collection(db, "categories");
  await addDoc(categoriesCollection, {
    companyId,
    name: name.trim(),
    createdBy: adminUid,
    createdAt: serverTimestamp(),
  });
}

