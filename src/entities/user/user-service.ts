import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { getFirebaseDb } from "../../lib/firebase";

export type UserListItem = { uid: string; email: string; role?: "admin" | "employee" };

/** Для admin: список користувачів (для вибору працівника). */
export async function listUsersForAdmin(): Promise<UserListItem[]> {
  const db = getFirebaseDb();
  const usersCollection = collection(db, "users");
  const snapshot = await getDocs(query(usersCollection, orderBy("email", "asc")));
  return snapshot.docs.map((d) => {
    const data = d.data() as { email?: string; role?: "admin" | "employee" };
    return { uid: d.id, email: data.email ?? "", role: data.role };
  });
}

