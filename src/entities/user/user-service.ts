import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { getFirebaseDb } from "../../lib/firebase";

export type UserListItem = { uid: string; email: string; role?: "admin" | "employee" };

/** Для admin: список користувачів однієї компанії (вибір працівника для виплат). */
export async function listUsersForAdmin(companyId: string): Promise<UserListItem[]> {
  const db = getFirebaseDb();
  const usersCollection = collection(db, "users");
  const snapshot = await getDocs(
    query(usersCollection, where("companyId", "==", companyId), orderBy("email", "asc")),
  );
  return snapshot.docs.map((d) => {
    const data = d.data() as { email?: string; role?: "admin" | "employee" };
    return { uid: d.id, email: data.email ?? "", role: data.role };
  });
}

