import { collection, doc, getDoc, serverTimestamp, writeBatch, type Firestore } from "firebase/firestore";
import { getFirebaseDb } from "../../lib/firebase";

const JOIN_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Нормалізує код запрошення (без пробілів, верхній регістр). */
export function normalizeJoinCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function generateJoinCode(): string {
  let s = "";
  for (let i = 0; i < 8; i++) {
    s += JOIN_CODE_CHARS[Math.floor(Math.random() * JOIN_CODE_CHARS.length)];
  }
  return s;
}

/**
 * Підбирає унікальний код для `companyJoinCodes/{code}`.
 */
export async function ensureUniqueJoinCode(db: Firestore = getFirebaseDb()): Promise<string> {
  for (let attempt = 0; attempt < 24; attempt++) {
    const code = generateJoinCode();
    const ref = doc(db, "companyJoinCodes", code);
    const snap = await getDoc(ref);
    if (!snap.exists()) return code;
  }
  throw new Error("Не вдалося згенерувати код компанії. Спробуйте ще раз.");
}

/**
 * Повертає `companyId` за кодом запрошення або `null`.
 */
export async function resolveCompanyIdFromJoinCode(joinCode: string): Promise<string | null> {
  const code = normalizeJoinCode(joinCode);
  if (code.length < 6) return null;
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, "companyJoinCodes", code));
  if (!snap.exists()) return null;
  const data = snap.data() as { companyId?: string };
  return typeof data.companyId === "string" ? data.companyId : null;
}

/**
 * Атомарно створює компанію, мапу коду та профіль адміністратора (після `createUserWithEmailAndPassword`).
 */
export async function commitNewCompanyAndAdminProfile(
  uid: string,
  email: string,
  companyName: string,
  joinCode: string,
): Promise<string> {
  const db = getFirebaseDb();
  const companyRef = doc(collection(db, "companies"));
  const companyId = companyRef.id;
  const batch = writeBatch(db);
  const name = companyName.trim();
  batch.set(companyRef, {
    name,
    joinCode,
    createdAt: serverTimestamp(),
    createdByUid: uid,
  });
  batch.set(doc(db, "companyJoinCodes", joinCode), { companyId });
  batch.set(doc(db, "users", uid), {
    email,
    companyId,
    companyName: name,
    role: "admin",
  });
  await batch.commit();
  return companyId;
}

/** Код запрошення для співробітників (читання дозволене лише учасникам компанії за правилами). */
export async function getCompanyJoinCode(companyId: string): Promise<string | null> {
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, "companies", companyId));
  if (!snap.exists()) return null;
  const j = (snap.data() as { joinCode?: string }).joinCode;
  return typeof j === "string" ? j : null;
}
