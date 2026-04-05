import { getFirebaseAuth } from "./firebase";

/** Поточний UID з Firebase Auth (після await — перевірити, щоб не застосувати стару відповідь). */
export function getRequestAuthUid(): string | null {
  return getFirebaseAuth().currentUser?.uid ?? null;
}
