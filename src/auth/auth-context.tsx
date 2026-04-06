import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "../lib/firebase";

export type Role = "admin" | "employee";
export type AppUser = { uid: string; email: string; role: Role };

type AuthContextValue = {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function resolveRole(firebaseUser: User): Promise<Role> {
  const db = getFirebaseDb();
  const ref = doc(db, "users", firebaseUser.uid);
  const snap = await getDoc(ref);
  const data = snap.exists() ? (snap.data() as { role?: Role }) : null;
  return data?.role === "admin" ? "admin" : "employee";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (!firebaseUser?.email) {
          setUser(null);
          return;
        }
        const db = getFirebaseDb();
        try {
          await setDoc(doc(db, "users", firebaseUser.uid), { email: firebaseUser.email }, { merge: true });
          const role = await resolveRole(firebaseUser);
          setUser({ uid: firebaseUser.uid, email: firebaseUser.email, role });
        } catch {
          // Якщо Firestore недоступний або відмовляє в правилах — не залишаємо сесію Auth «живою»
          // без user у React (інакше мобільний вхід здається зламаним, тоді як веб без цього кроку працює).
          setUser({ uid: firebaseUser.uid, email: firebaseUser.email, role: "employee" });
        }
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login: async (email, password) => {
        setLoading(true);
        try {
          await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
          // Не викликати setLoading(false) тут: onAuthStateChanged ще асинхронно
          // підтягує роль з Firestore. Інакше коротко буде loading=false і user=null —
          // навігація покаже екран входу замість застосунку.
        } catch (e) {
          setLoading(false);
          throw e;
        }
      },
      register: async (email, password) => {
        setLoading(true);
        try {
          const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
          const db = getFirebaseDb();
          await setDoc(doc(db, "users", cred.user.uid), {
            role: "employee",
            email: cred.user.email ?? email,
          });
        } catch (e) {
          setLoading(false);
          throw e;
        }
        // setLoading(false) після успіху — у onAuthStateChanged
      },
      logout: async () => {
        await signOut(getFirebaseAuth());
      },
    }),
    [loading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

