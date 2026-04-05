export function firestoreActionError(e: unknown, fallback: string): string {
  const code = e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
  if (code === "permission-denied") return "Немає прав. Перевірте Firestore Rules.";
  return fallback;
}
