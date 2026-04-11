import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export type EmployeeSummaryPayload = {
  monthTitle: string;
  monthEarned: number;
  monthPaid: number;
  monthBalance: number;
  totalEarned: number;
  totalPaid: number;
  totalBalance: number;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  data: EmployeeSummaryPayload | null;
};

function money(n: number): string {
  return `${n.toFixed(2)} грн`;
}

/**
 * Повноекранне повідомлення для працівника після входу: зароблено / виплачено / залишок за місяць і загалом.
 */
export function EmployeeEntrySummaryModal({ visible, onClose, data }: Props) {
  if (!data) return null;
  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.kicker}>Фінансовий підсумок</Text>
          <Text style={styles.title}>Ваші нарахування та виплати</Text>
          <Text style={styles.lead}>
            Нижче — скільки ви заробили за роботами, скільки вже виплачено та який залишок.
          </Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Поточний місяць ({data.monthTitle})</Text>
            <Row label="Зароблено (роботи)" value={money(data.monthEarned)} strong />
            <Row label="Виплачено" value={`− ${money(data.monthPaid)}`} muted />
            <Row label="Залишок за місяць" value={money(data.monthBalance)} highlight />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>За весь час</Text>
            <Row label="Зароблено всього" value={money(data.totalEarned)} strong />
            <Row label="Виплачено всього" value={`− ${money(data.totalPaid)}`} muted />
            <Row label="Залишок загалом" value={money(data.totalBalance)} highlight />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable style={styles.primaryButton} onPress={onClose} accessibilityRole="button">
            <Text style={styles.primaryButtonText}>Зрозуміло</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function Row({ label, value, muted, strong, highlight }: { label: string; value: string; muted?: boolean; strong?: boolean; highlight?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, strong ? styles.rowLabelStrong : null]}>{label}</Text>
      <Text style={[styles.rowValue, muted ? styles.rowValueMuted : null, highlight ? styles.rowValueHighlight : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f6f8ff" },
  scroll: { padding: 20, paddingBottom: 24 },
  kicker: { fontSize: 13, fontWeight: "800", color: "#3158f5", textTransform: "uppercase", letterSpacing: 0.6 },
  title: { fontSize: 24, fontWeight: "900", color: "#0b1220", marginTop: 8, marginBottom: 10 },
  lead: { fontSize: 15, color: "#475569", lineHeight: 22, marginBottom: 20 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e7ecfb",
    gap: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#1e3a8a", marginBottom: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  rowLabel: { flex: 1, fontSize: 15, color: "#64748b", fontWeight: "600" },
  rowLabelStrong: { color: "#334155", fontWeight: "700" },
  rowValue: { fontSize: 15, fontWeight: "800", color: "#0b1220", textAlign: "right", maxWidth: "52%" },
  rowValueMuted: { color: "#64748b" },
  rowValueHighlight: { fontSize: 17, fontWeight: "900", color: "#3158f5" },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: "#e7ecfb",
    backgroundColor: "#fff",
  },
  primaryButton: {
    backgroundColor: "#3158f5",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: { color: "#fff", fontWeight: "900", fontSize: 17 },
});
