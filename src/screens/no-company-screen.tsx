import React from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../auth/auth-context";

/**
 * Обліковий запис без `companyId` (дані до появи «компаній» у додатку).
 */
export function NoCompanyScreen() {
  const { logout } = useAuth();

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Потрібна компанія</Text>
        <Text style={styles.text}>
          У профілі ще немає прив’язки до організації — тому додаток не показує роботи. Якщо це той самий проєкт, що й раніше,
          потрібна одноразова міграція в Firestore (додати компанію й поле companyId до старих записів).
        </Text>
        <Text style={styles.subheading}>Що зробити власнику / розробнику</Text>
        <Text style={styles.bullet}>
          1. Firebase Console → Project settings → Service accounts → згенерувати JSON ключ.
        </Text>
        <Text style={styles.bullet}>
          2. На комп’ютері з Node.js: встановити залежності (`npm install`), вказати шлях до ключа та запустити міграцію з кореня
          проєкту (деталі в коментарі на початку файлу scripts/migrate-legacy-to-company.cjs).
        </Text>
        <Text style={styles.bullet}>
          3. Команда виглядає так: npm run migrate:legacy-company -- --admin-email="ваш@email" --company-name="Назва фірми"
        </Text>
        <Text style={styles.hint}>
          Після успіху перезапустіть додаток і увійдіть знову — роботи та виплати залишаться, бо їм лише додається той самий
          ідентифікатор компанії.
        </Text>
        <Pressable style={styles.button} onPress={() => void logout()}>
          <Text style={styles.buttonText}>Вийти</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  scroll: { padding: 24, paddingBottom: 40, gap: 12 },
  title: { fontSize: 22, fontWeight: "700", textAlign: "center" },
  text: { fontSize: 16, color: "#3d4a5c", lineHeight: 22 },
  subheading: { fontSize: 16, fontWeight: "700", color: "#0b1220", marginTop: 8 },
  bullet: { fontSize: 15, color: "#3d4a5c", lineHeight: 22 },
  hint: { fontSize: 14, color: "#5b6475", lineHeight: 20, marginTop: 4 },
  button: { backgroundColor: "#3158f5", borderRadius: 10, padding: 14, alignItems: "center", marginTop: 16 },
  buttonText: { color: "#fff", fontWeight: "700" },
});
