import React from "react";
import { StyleSheet, Text, View } from "react-native";

type Props = {
  earned: number;
  paidOut: number;
};

/** Підсумок для працівника: зароблено за роботами, виплачено, залишок. */
export function EmployeeBalanceCard({ earned, paidOut }: Props) {
  const balance = earned - paidOut;
  return (
    <View style={styles.wrap}>
      <Text style={styles.cardTitle}>Мій баланс</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Зароблено (роботи)</Text>
        <Text style={styles.value}>{earned.toFixed(2)} грн</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Виплачено</Text>
        <Text style={styles.valueMuted}>− {paidOut.toFixed(2)} грн</Text>
      </View>
      <View style={[styles.row, styles.rowTotal]}>
        <Text style={styles.labelStrong}>Залишок</Text>
        <Text style={styles.valueStrong}>{balance.toFixed(2)} грн</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#eef2ff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#c7d2fe",
    padding: 14,
    marginBottom: 12,
    gap: 8,
  },
  cardTitle: { fontSize: 15, fontWeight: "800", color: "#1e3a8a", marginBottom: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  rowTotal: {
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#c7d2fe",
  },
  label: { flex: 1, color: "#475569", fontWeight: "600", fontSize: 14 },
  labelStrong: { flex: 1, color: "#0f172a", fontWeight: "800", fontSize: 15 },
  value: { fontWeight: "800", color: "#0b1220", fontSize: 15 },
  valueMuted: { fontWeight: "800", color: "#64748b", fontSize: 15 },
  valueStrong: { fontWeight: "900", color: "#3158f5", fontSize: 17 },
});
