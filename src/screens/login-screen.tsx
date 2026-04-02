import React, { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../auth/auth-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";

type Props = NativeStackScreenProps<RootStackParamList, "AuthLogin">;

export function LoginScreen({ navigation }: Props) {
  const { login, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.container}>
        <Text style={styles.title}>Вхід</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" placeholder="Email" />
        <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="Пароль" />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          style={[styles.button, loading ? styles.buttonDisabled : null]}
          disabled={loading}
          onPress={async () => {
            setError(null);
            try {
              await login(email.trim(), password);
            } catch {
              setError("Не вдалося увійти. Перевірте email/пароль.");
            }
          }}
        >
          <Text style={styles.buttonText}>{loading ? "..." : "Увійти"}</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate("AuthRegister")}>
          <Text style={styles.link}>Немає акаунта? Реєстрація</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: { flex: 1, padding: 16, gap: 12, justifyContent: "center", backgroundColor: "#fff" },
  title: { fontSize: 22, fontWeight: "700", textAlign: "center", marginBottom: 8 },
  input: { borderWidth: 1, borderColor: "#dbe1ef", borderRadius: 10, padding: 12, backgroundColor: "#fff" },
  button: { backgroundColor: "#3158f5", borderRadius: 10, padding: 12, alignItems: "center" },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontWeight: "700" },
  link: { textAlign: "center", color: "#3158f5", marginTop: 10 },
  error: { color: "#ce2e2e", textAlign: "center" },
});

