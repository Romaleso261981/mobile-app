import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../auth/auth-context";
import { authErrorMessage } from "../shared/auth-errors";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";

type Props = NativeStackScreenProps<RootStackParamList, "AuthRegisterJoin">;

function joinRegisterErrorMessage(e: unknown): string {
  if (e instanceof Error && e.message === "INVALID_JOIN_CODE") {
    return "Невірний або застарілий код компанії. Уточніть код у адміністратора.";
  }
  return authErrorMessage(e, "register");
}

export function RegisterJoinScreen({ navigation }: Props) {
  const { registerWithJoinCode, loading } = useAuth();
  const [joinCode, setJoinCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.form}>
            <Text style={styles.title}>Приєднатися до компанії</Text>
            <Text style={styles.subtitle}>Введіть код, який видав адміністратор вашої організації.</Text>
            <TextInput
              style={styles.input}
              value={joinCode}
              onChangeText={setJoinCode}
              placeholder="Код компанії"
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
            />
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!passwordVisible}
                placeholder="Пароль (мін. 6 символів)"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password-new"
                textContentType="newPassword"
              />
              <Pressable
                style={styles.eyeButton}
                onPress={() => setPasswordVisible((v) => !v)}
                accessibilityLabel={passwordVisible ? "Приховати пароль" : "Показати пароль"}
                accessibilityRole="button"
                hitSlop={8}
              >
                <Ionicons name={passwordVisible ? "eye-off-outline" : "eye-outline"} size={22} color="#5b6475" />
              </Pressable>
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable
              style={[styles.button, loading ? styles.buttonDisabled : null]}
              disabled={loading}
              onPress={async () => {
                setError(null);
                try {
                  await registerWithJoinCode(joinCode, email.trim(), password);
                } catch (e) {
                  setError(joinRegisterErrorMessage(e));
                }
              }}
            >
              <Text style={styles.buttonText}>{loading ? "..." : "Створити акаунт"}</Text>
            </Pressable>
            <Pressable onPress={() => navigation.navigate("AuthRegisterHub")}>
              <Text style={styles.link}>Назад</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    justifyContent: "center",
  },
  form: { gap: 12 },
  title: { fontSize: 22, fontWeight: "700", textAlign: "center", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#5b6475", textAlign: "center", marginBottom: 8, lineHeight: 20 },
  input: { borderWidth: 1, borderColor: "#dbe1ef", borderRadius: 10, padding: 12, backgroundColor: "#fff" },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#dbe1ef",
    borderRadius: 10,
    backgroundColor: "#fff",
    paddingRight: 2,
    minHeight: 48,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    fontSize: 16,
    color: "#0b1220",
  },
  eyeButton: { padding: 10, justifyContent: "center", alignItems: "center" },
  button: { backgroundColor: "#3158f5", borderRadius: 10, padding: 12, alignItems: "center" },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontWeight: "700" },
  link: { textAlign: "center", color: "#3158f5", marginTop: 10 },
  error: { color: "#ce2e2e", textAlign: "center" },
});
