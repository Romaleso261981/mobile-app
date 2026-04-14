import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseDb } from "../lib/firebase";
import {
  commitNewCompanyAndAdminProfile,
  ensureUniqueJoinCode,
  normalizeJoinCode,
  resolveCompanyIdFromJoinCode,
} from "../entities/company/company-service";

export type Role = "admin" | "employee";
export type AppUser = {
  uid: string;
  email: string;
  role: Role;
  /** `null` — обліковий запис без компанії (застарілі дані або помилка). */
  companyId: string | null;
  companyName: string | null;
};

type AuthContextValue = {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Перший користувач компанії — адміністратор. */
  registerCompany: (companyName: string, email: string, password: string) => Promise<void>;
  /** Співробітник за кодом запрошення. */
  registerWithJoinCode: (joinCode: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadAppUser(firebaseUser: User): Promise<AppUser> {
  const db = getFirebaseDb();
  const ref = doc(db, "users", firebaseUser.uid);
  const snap = await getDoc(ref);
  const data = snap.exists()
    ? (snap.data() as { role?: Role; companyId?: string; companyName?: string })
    : {};
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email ?? "",
    role: data.role === "admin" ? "admin" : "employee",
    companyId: typeof data.companyId === "string" ? data.companyId : null,
    companyName: typeof data.companyName === "string" ? data.companyName : null,
  };
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
          const appUser = await loadAppUser(firebaseUser);
          setUser(appUser);
        } catch {
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            role: "employee",
            companyId: null,
            companyName: null,
          });
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
        } catch (e) {
          setLoading(false);
          throw e;
        }
      },
      registerCompany: async (companyName, email, password) => {
        setLoading(true);
        try {
          const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
          const joinCode = await ensureUniqueJoinCode();
          await commitNewCompanyAndAdminProfile(cred.user.uid, cred.user.email ?? email.trim(), companyName, joinCode);
        } catch (e) {
          throw e;
        } finally {
          setLoading(false);
        }
      },
      registerWithJoinCode: async (joinCode, email, password) => {
        setLoading(true);
        try {
          const jc = normalizeJoinCode(joinCode);
          if (jc.length < 6) {
            throw new Error("INVALID_JOIN_CODE");
          }
          const companyId = await resolveCompanyIdFromJoinCode(jc);
          if (!companyId) {
            throw new Error("INVALID_JOIN_CODE");
          }
          const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
          const db = getFirebaseDb();
          await setDoc(doc(db, "users", cred.user.uid), {
            role: "employee",
            email: cred.user.email ?? email.trim(),
            companyId,
            joinCode: jc,
          });
        } catch (e) {
          throw e;
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
