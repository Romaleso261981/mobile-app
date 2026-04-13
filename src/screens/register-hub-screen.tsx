import React from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";

type Props = NativeStackScreenProps<RootStackParamList, "AuthRegisterHub">;

export function RegisterHubScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Реєстрація</Text>
        <Text style={styles.subtitle}>Спочатку створіть організацію або приєднайтесь за кодом від адміністратора.</Text>

        <Pressable style={styles.primary} onPress={() => navigation.navigate("AuthRegisterCompany")}>
          <Text style={styles.primaryText}>Створити компанію</Text>
          <Text style={styles.hint}>Ви будете адміністратором цієї організації.</Text>
        </Pressable>

        <Pressable style={styles.secondary} onPress={() => navigation.navigate("AuthRegisterJoin")}>
          <Text style={styles.secondaryText}>Маю код компанії</Text>
          <Text style={styles.hint}>Для співробітників: код вам надає адмін.</Text>
        </Pressable>

        <Pressable onPress={() => navigation.navigate("AuthLogin")}>
          <Text style={styles.link}>Вже є акаунт? Увійти</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  scroll: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 32, gap: 16 },
  title: { fontSize: 22, fontWeight: "700", textAlign: "center" },
  subtitle: { fontSize: 15, color: "#5b6475", textAlign: "center", lineHeight: 22, marginBottom: 8 },
  primary: {
    backgroundColor: "#3158f5",
    borderRadius: 12,
    padding: 16,
    gap: 6,
  },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 17 },
  secondary: {
    borderWidth: 1,
    borderColor: "#dbe1ef",
    borderRadius: 12,
    padding: 16,
    gap: 6,
    backgroundColor: "#fafbff",
  },
  secondaryText: { color: "#0b1220", fontWeight: "700", fontSize: 17 },
  hint: { fontSize: 13, color: "#7b8599", lineHeight: 18 },
  link: { textAlign: "center", color: "#3158f5", marginTop: 12 },
});
