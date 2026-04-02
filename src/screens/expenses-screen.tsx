import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuth } from "../auth/auth-context";
import { createSalaryPayout, listUserSalaryPayouts } from "../entities/payout/payout-service";
import type { SalaryPayout } from "../entities/payout/types";
import { matchesDateString, type DateFilterPreset } from "../shared/date-filter";

export function ExpensesScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<SalaryPayout[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [datePreset, setDatePreset] = useState<DateFilterPreset>("all");
  const [dateYear, setDateYear] = useState(() => String(new Date().getFullYear()));
  const [dateMonth, setDateMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [payoutDate, setPayoutDate] = useState(today);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");

  const filteredItems = useMemo(() => {
    const s = searchTerm.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch = !s ? true : item.description.toLowerCase().includes(s) || item.payoutDate.includes(s);
      const matchesDate = matchesDateString(item.payoutDate, datePreset, dateYear, dateMonth, dateFrom, dateTo);
      return matchesSearch && matchesDate;
    });
  }, [dateFrom, dateMonth, datePreset, dateTo, dateYear, items, searchTerm]);

  const filteredTotal = useMemo(() => filteredItems.reduce((acc, item) => acc + (item.amount ?? 0), 0), [filteredItems]);

  async function loadAll() {
    if (!user) return;
    setError(null);
    setLoading(true);
    try {
      setItems(await listUserSalaryPayouts(user.uid));
    } catch {
      setError("Не вдалося завантажити виплати.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Витрати</Text>
          <Text style={styles.meta}>{user?.email}</Text>
        </View>
        <Pressable style={styles.primaryButton} onPress={() => setCreateOpen(true)}>
          <Text style={styles.primaryButtonText}>+ Додати</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <Pressable style={styles.secondaryButton} onPress={() => loadAll()}>
            <Text style={styles.secondaryButtonText}>Спробувати ще</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={filteredItems.length ? undefined : styles.emptyContainer}
          ListHeaderComponent={
            <View style={styles.filters}>
              <TextInput style={styles.input} value={searchTerm} onChangeText={setSearchTerm} placeholder="Пошук (опис/дата)" />
              <Pressable
                style={styles.secondaryButton}
                onPress={() => setDatePreset((prev) => (prev === "all" ? "month" : prev === "month" ? "year" : prev === "year" ? "range" : "all"))}
              >
                <Text style={styles.secondaryButtonText}>
                  {datePreset === "all" ? "Усі дати" : datePreset === "month" ? "Місяць" : datePreset === "year" ? "Рік" : "Період"}
                </Text>
              </Pressable>

              {datePreset === "year" ? (
                <TextInput style={styles.input} value={dateYear} onChangeText={setDateYear} placeholder="Рік (YYYY)" keyboardType="number-pad" />
              ) : null}
              {datePreset === "month" ? (
                <TextInput style={styles.input} value={dateMonth} onChangeText={setDateMonth} placeholder="Місяць (YYYY-MM)" autoCapitalize="none" />
              ) : null}
              {datePreset === "range" ? (
                <View style={styles.row}>
                  <TextInput style={[styles.input, styles.rowGrow]} value={dateFrom} onChangeText={setDateFrom} placeholder="Від (YYYY-MM-DD)" autoCapitalize="none" />
                  <TextInput style={[styles.input, styles.rowGrow]} value={dateTo} onChangeText={setDateTo} placeholder="До (YYYY-MM-DD)" autoCapitalize="none" />
                </View>
              ) : null}

              {filteredItems.length ? (
                <View style={styles.totalBanner}>
                  <Text style={styles.totalLabel}>Разом (за фільтром)</Text>
                  <Text style={styles.totalValue}>{filteredTotal.toFixed(2)} грн</Text>
                </View>
              ) : null}
            </View>
          }
          onRefresh={async () => {
            if (!user) return;
            setRefreshing(true);
            try {
              setItems(await listUserSalaryPayouts(user.uid));
            } finally {
              setRefreshing(false);
            }
          }}
          refreshing={refreshing}
          ListEmptyComponent={<Text style={styles.emptyText}>Поки що немає виплат. Натисни “Додати”.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>{item.payoutDate}</Text>
                <Text style={styles.cardAmount}>{item.amount} грн</Text>
              </View>
              <Text style={styles.cardBody}>{item.description}</Text>
            </View>
          )}
        />
      )}

      <Modal visible={createOpen} animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Нова виплата</Text>

          <Text style={styles.label}>Дата (YYYY-MM-DD)</Text>
          <TextInput style={styles.input} value={payoutDate} onChangeText={setPayoutDate} placeholder="2026-04-02" autoCapitalize="none" />

          <Text style={styles.label}>Опис</Text>
          <TextInput style={[styles.input, styles.textarea]} value={description} onChangeText={setDescription} placeholder="За що виплата?" multiline />

          <Text style={styles.label}>Сума (грн)</Text>
          <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="0" />

          <View style={styles.modalActions}>
            <Pressable style={styles.secondaryButton} onPress={() => setCreateOpen(false)}>
              <Text style={styles.secondaryButtonText}>Скасувати</Text>
            </Pressable>
            <Pressable
              style={styles.primaryButton}
              onPress={async () => {
                if (!user) return;
                setLoading(true);
                try {
                  const parsed = Number(amount.replace(",", "."));
                  if (!Number.isFinite(parsed)) throw new Error("invalid amount");
                  await createSalaryPayout({
                    userId: user.uid,
                    userEmail: user.email,
                    payoutDate: payoutDate.trim(),
                    description: description.trim(),
                    amount: parsed,
                  });
                  setCreateOpen(false);
                  setDescription("");
                  setAmount("");
                  setItems(await listUserSalaryPayouts(user.uid));
                } catch {
                  setError("Не вдалося створити виплату.");
                } finally {
                  setLoading(false);
                }
              }}
            >
              <Text style={styles.primaryButtonText}>Зберегти</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12, backgroundColor: "#f6f8ff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  headerLeft: { flex: 1 },
  title: { fontSize: 22, fontWeight: "800", color: "#0b1220" },
  meta: { color: "#5b6475", marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  error: { color: "#ce2e2e", textAlign: "center" },
  emptyContainer: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  emptyText: { color: "#5b6475", textAlign: "center" },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: "#e7ecfb" },
  cardTop: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 10 },
  cardTitle: { fontWeight: "800", color: "#0b1220" },
  cardAmount: { fontWeight: "900", color: "#0b1220" },
  cardBody: { marginTop: 6, color: "#1a2740" },
  primaryButton: { backgroundColor: "#3158f5", borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, alignItems: "center" },
  primaryButtonText: { color: "#fff", fontWeight: "800" },
  secondaryButton: { backgroundColor: "#ffffff", borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, alignItems: "center", borderWidth: 1, borderColor: "#dbe1ef" },
  secondaryButtonText: { color: "#3158f5", fontWeight: "800" },
  modalContainer: { flex: 1, padding: 16, gap: 10, backgroundColor: "#fff" },
  modalTitle: { fontSize: 20, fontWeight: "800", marginBottom: 6 },
  label: { color: "#5b6475", fontWeight: "700" },
  input: { borderWidth: 1, borderColor: "#dbe1ef", borderRadius: 12, padding: 12, backgroundColor: "#fff" },
  textarea: { minHeight: 90, textAlignVertical: "top" },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 10 },
  filters: { gap: 10, marginBottom: 12 },
  row: { flexDirection: "row", gap: 10, alignItems: "center" },
  rowGrow: { flex: 1 },
  totalBanner: { backgroundColor: "#0b1220", borderRadius: 12, padding: 12, flexDirection: "row", justifyContent: "space-between" },
  totalLabel: { color: "#cbd5f5", fontWeight: "800" },
  totalValue: { color: "#fff", fontWeight: "900" },
});

