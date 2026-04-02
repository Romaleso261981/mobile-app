import { addDoc, collection, getDocs, orderBy, query, serverTimestamp } from "firebase/firestore";
import { getFirebaseDb } from "../../lib/firebase";
import type { Category } from "./types";

export async function listCategories(): Promise<Category[]> {
  const db = getFirebaseDb();
  const categoriesCollection = collection(db, "categories");
  const snapshot = await getDocs(query(categoriesCollection, orderBy("name", "asc")));

  return snapshot.docs.map((item) => ({
    id: item.id,
    name: item.data().name as string,
  }));
}

export async function addCategory(name: string, adminUid: string): Promise<void> {
  const db = getFirebaseDb();
  const categoriesCollection = collection(db, "categories");
  await addDoc(categoriesCollection, {
    name: name.trim(),
    createdBy: adminUid,
    createdAt: serverTimestamp(),
  });
}

