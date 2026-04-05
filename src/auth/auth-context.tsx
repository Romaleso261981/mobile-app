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
        await setDoc(doc(db, "users", firebaseUser.uid), { email: firebaseUser.email }, { merge: true });
        const role = await resolveRole(firebaseUser);
        setUser({ uid: firebaseUser.uid, email: firebaseUser.email, role });
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
        } finally {
          setLoading(false);
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
        } finally {
          setLoading(false);
        }
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

