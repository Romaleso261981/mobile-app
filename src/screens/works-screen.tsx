import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../auth/auth-context";
import { listCategories } from "../entities/category/category-service";
import type { Category } from "../entities/category/types";
import { createWorkEntry, listUserWorkEntries } from "../entities/work/work-service";
import type { WorkEntry } from "../entities/work/types";
import { matchesDateString, type DateFilterPreset } from "../shared/date-filter";

export function WorksScreen() {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<WorkEntry[]>([]);

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
  const [workDate, setWorkDate] = useState(today);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);

  const selectedCategory = useMemo(() => categories.find((c) => c.id === categoryId) ?? null, [categories, categoryId]);

  const filteredItems = useMemo(() => {
    const s = searchTerm.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch = !s
        ? true
        : item.description.toLowerCase().includes(s) || item.workDate.includes(s) || item.categoryName.toLowerCase().includes(s);
      const matchesCategory = categoryId ? item.categoryId === categoryId : true;
      const matchesDate = matchesDateString(item.workDate, datePreset, dateYear, dateMonth, dateFrom, dateTo);
      return matchesSearch && matchesCategory && matchesDate;
    });
  }, [categoryId, dateFrom, dateMonth, datePreset, dateTo, dateYear, items, searchTerm]);

  const filteredTotal = useMemo(() => filteredItems.reduce((acc, item) => acc + (item.amount ?? 0), 0), [filteredItems]);

  async function loadAll() {
    if (!user) return;
    setError(null);
    setLoading(true);
    try {
      const [cats, works] = await Promise.all([listCategories(), listUserWorkEntries(user.uid)]);
      setCategories(cats);
      setItems(works);
      if (!categoryId && cats[0]) setCategoryId(cats[0].id);
    } catch (e) {
      setError("Не вдалося завантажити дані.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Роботи</Text>
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
              <TextInput
                style={styles.input}
                value={searchTerm}
                onChangeText={setSearchTerm}
                placeholder="Пошук (опис/дата/категорія)"
              />

              <View style={styles.row}>
                <Pressable style={[styles.picker, styles.rowGrow]} onPress={() => setCategoryPickerOpen(true)}>
                  <Text style={styles.pickerText}>{selectedCategory?.name ?? "Усі категорії"}</Text>
                </Pressable>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => setDatePreset((prev) => (prev === "all" ? "month" : prev === "month" ? "year" : prev === "year" ? "range" : "all"))}
                >
                  <Text style={styles.secondaryButtonText}>
                    {datePreset === "all" ? "Усі дати" : datePreset === "month" ? "Місяць" : datePreset === "year" ? "Рік" : "Період"}
                  </Text>
                </Pressable>
              </View>

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
              setItems(await listUserWorkEntries(user.uid));
            } finally {
              setRefreshing(false);
            }
          }}
          refreshing={refreshing}
          ListEmptyComponent={<Text style={styles.emptyText}>Поки що немає записів. Натисни “Додати”.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>{item.categoryName}</Text>
                <Text style={styles.cardMeta}>{item.workDate}</Text>
              </View>
              <Text style={styles.cardBody}>{item.description}</Text>
              <Text style={styles.cardAmount}>{item.amount} грн</Text>
            </View>
          )}
        />
      )}

      <View style={styles.footer}>
        <Pressable style={styles.secondaryButton} onPress={() => logout()}>
          <Text style={styles.secondaryButtonText}>Вийти</Text>
        </Pressable>
      </View>

      <Modal visible={createOpen} animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Нова робота</Text>

          <Text style={styles.label}>Дата (YYYY-MM-DD)</Text>
          <TextInput style={styles.input} value={workDate} onChangeText={setWorkDate} placeholder="2026-04-02" autoCapitalize="none" />

          <Text style={styles.label}>Категорія</Text>
          <Pressable style={styles.picker} onPress={() => setCategoryPickerOpen(true)}>
            <Text style={styles.pickerText}>{selectedCategory?.name ?? "Оберіть категорію"}</Text>
          </Pressable>

          <Text style={styles.label}>Опис</Text>
          <TextInput style={[styles.input, styles.textarea]} value={description} onChangeText={setDescription} placeholder="Що зроблено?" multiline />

          <Text style={styles.label}>Сума (грн, необов’язково)</Text>
          <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="0" />

          <View style={styles.modalActions}>
            <Pressable style={styles.secondaryButton} onPress={() => setCreateOpen(false)}>
              <Text style={styles.secondaryButtonText}>Скасувати</Text>
            </Pressable>
            <Pressable
              style={styles.primaryButton}
              onPress={async () => {
                if (!user) return;
                const category = categories.find((c) => c.id === categoryId);
                if (!category) {
                  setError("Категорію не знайдено.");
                  setCreateOpen(false);
                  return;
                }
                setLoading(true);
                try {
                  await createWorkEntry({
                    userId: user.uid,
                    userEmail: user.email,
                    workDate: workDate.trim(),
                    description: description.trim(),
                    categoryId: category.id,
                    categoryName: category.name,
                    amount: amount.trim() ? Number(amount.replace(",", ".")) : undefined,
                  });
                  setCreateOpen(false);
                  setDescription("");
                  setAmount("");
                  setItems(await listUserWorkEntries(user.uid));
                } catch {
                  setError("Не вдалося створити запис.");
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

      <Modal visible={categoryPickerOpen} transparent animationType="fade" onRequestClose={() => setCategoryPickerOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setCategoryPickerOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Оберіть категорію</Text>
            <FlatList
              data={[{ id: "", name: "Усі категорії" } as Category, ...categories]}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.sheetRow, item.id === categoryId ? styles.sheetRowActive : null]}
                  onPress={() => {
                    setCategoryId(item.id);
                    setCategoryPickerOpen(false);
                  }}
                >
                  <Text style={styles.sheetRowText}>{item.name}</Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f6f8ff" },
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
  cardMeta: { color: "#5b6475", fontSize: 12 },
  cardBody: { marginTop: 6, color: "#1a2740" },
  cardAmount: { marginTop: 10, fontWeight: "800", color: "#0b1220" },
  footer: { paddingTop: 6 },
  primaryButton: { backgroundColor: "#3158f5", borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, alignItems: "center" },
  primaryButtonText: { color: "#fff", fontWeight: "800" },
  secondaryButton: { backgroundColor: "#ffffff", borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, alignItems: "center", borderWidth: 1, borderColor: "#dbe1ef" },
  secondaryButtonText: { color: "#3158f5", fontWeight: "800" },
  modalContainer: { flex: 1, padding: 16, gap: 10, backgroundColor: "#fff" },
  modalTitle: { fontSize: 20, fontWeight: "800", marginBottom: 6 },
  label: { color: "#5b6475", fontWeight: "700" },
  input: { borderWidth: 1, borderColor: "#dbe1ef", borderRadius: 12, padding: 12, backgroundColor: "#fff" },
  textarea: { minHeight: 90, textAlignVertical: "top" },
  picker: { borderWidth: 1, borderColor: "#dbe1ef", borderRadius: 12, padding: 12, backgroundColor: "#f8faff" },
  pickerText: { color: "#0b1220", fontWeight: "700" },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 10 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 14, maxHeight: "70%" },
  sheetTitle: { fontWeight: "800", fontSize: 16, marginBottom: 10 },
  sheetRow: { paddingVertical: 12, paddingHorizontal: 10, borderRadius: 10 },
  sheetRowActive: { backgroundColor: "#eef2ff" },
  sheetRowText: { fontWeight: "700", color: "#0b1220" },
  filters: { gap: 10, marginBottom: 12 },
  row: { flexDirection: "row", gap: 10, alignItems: "center" },
  rowGrow: { flex: 1 },
  totalBanner: { backgroundColor: "#0b1220", borderRadius: 12, padding: 12, flexDirection: "row", justifyContent: "space-between" },
  totalLabel: { color: "#cbd5f5", fontWeight: "800" },
  totalValue: { color: "#fff", fontWeight: "900" },
});

