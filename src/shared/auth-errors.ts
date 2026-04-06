type AuthLikeError = { code?: string };

function isAuthLikeError(e: unknown): e is AuthLikeError {
  return typeof e === "object" && e !== null && "code" in e;
}

type AuthErrorMode = "login" | "register";

/**
 * Людські повідомлення для Firebase Auth (email/пароль).
 * Допомагає відрізнити невірний пароль від неіснуючого акаунта тощо.
 */
export function authErrorMessage(e: unknown, mode: AuthErrorMode = "login"): string {
  if (!isAuthLikeError(e) || typeof e.code !== "string") {
    return mode === "register"
      ? "Не вдалося зареєструватися. Спробуйте ще раз."
      : "Сталася помилка. Спробуйте ще раз.";
  }
  switch (e.code) {
    case "auth/invalid-email":
      return "Некоректний формат email.";
    case "auth/user-disabled":
      return "Цей акаунт вимкнено. Зверніться до адміністратора.";
    case "auth/user-not-found":
      return "Користувача з таким email не знайдено в системі входу. Перевірте написання або зареєструйтесь.";
    case "auth/wrong-password":
      return "Невірний пароль.";
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
      return "Невірний email або пароль. Якщо ви лише додані в базу даних, потрібна реєстрація з паролем у додатку.";
    case "auth/too-many-requests":
      return "Забагато спроб. Зачекайте кілька хвилин і спробуйте знову.";
    case "auth/network-request-failed":
      return "Немає зв’язку з інтернетом. Перевірте мережу.";
    case "auth/email-already-in-use":
      return "Цей email уже зареєстровано. Увійдіть або скиньте пароль у Firebase.";
    case "auth/weak-password":
      return "Пароль занадто слабкий (мінімум 6 символів).";
    case "auth/operation-not-allowed":
      return "Вхід email/паролем вимкнено в налаштуваннях Firebase.";
    default:
      return mode === "register"
        ? "Не вдалося зареєструватися. Перевірте email і пароль."
        : "Не вдалося увійти. Перевірте email і пароль.";
  }
}
