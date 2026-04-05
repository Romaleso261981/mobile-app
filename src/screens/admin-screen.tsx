import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../auth/auth-context";
import { addCategory, listCategories } from "../entities/category/category-service";
import type { Category } from "../entities/category/types";
import { listAllSalaryPayouts } from "../entities/payout/payout-service";
import type { SalaryPayout } from "../entities/payout/types";
import { deleteWorkEntryAdmin, listAllWorkEntries, updateWorkEntryAdmin } from "../entities/work/work-service";
import type { WorkEntry } from "../entities/work/types";

function deleteWorkErrorMessage(e: unknown): string {
  const code = e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
  if (code === "permission-denied") {
    return "Немає прав на видалення. Опублікуйте правила з файлу firestore.rules у Firebase Console → Firestore → Rules.";
  }
  return "Не вдалося видалити запис.";
}

export function AdminScreen() {
  const { user, logout } = useAuth();
  const PAGE_SIZE = 5;
  const isAdmin = user?.role === "admin";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [works, setWorks] = useState<WorkEntry[]>([]);
  const [payouts, setPayouts] = useState<SalaryPayout[]>([]);
  const [adminView, setAdminView] = useState<"works" | "expenses">("works");
  const [worksPage, setWorksPage] = useState(1);
  const [payoutsPage, setPayoutsPage] = useState(1);

  const [createCategoryOpen, setCreateCategoryOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editWorkId, setEditWorkId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editAmount, setEditAmount] = useState("");

  const selectedWork = useMemo(() => works.find((w) => w.id === editWorkId) ?? null, [works, editWorkId]);
  const worksPageCount = useMemo(() => Math.max(1, Math.ceil(works.length / PAGE_SIZE)), [works.length]);
  const payoutsPageCount = useMemo(() => Math.max(1, Math.ceil(payouts.length / PAGE_SIZE)), [payouts.length]);
  const paginatedWorks = useMemo(() => {
    const from = (worksPage - 1) * PAGE_SIZE;
    return works.slice(from, from + PAGE_SIZE);
  }, [works, worksPage]);
  const paginatedPayouts = useMemo(() => {
    const from = (payoutsPage - 1) * PAGE_SIZE;
    return payouts.slice(from, from + PAGE_SIZE);
  }, [payouts, payoutsPage]);

  async function loadAll() {
    if (!user || !isAdmin) return;
    setError(null);
    setLoading(true);
    try {
      const [cats, allWorks, allPayouts] = await Promise.all([listCategories(), listAllWorkEntries(), listAllSalaryPayouts()]);
      setCategories(cats);
      setWorks(allWorks);
      setPayouts(allPayouts);
    } catch {
      setError("Не вдалося завантажити адмін-дані.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, user?.role]);

  useEffect(() => {
    if (worksPage > worksPageCount) setWorksPage(worksPageCount);
  }, [worksPage, worksPageCount]);

  useEffect(() => {
    if (payoutsPage > payoutsPageCount) setPayoutsPage(payoutsPageCount);
  }, [payoutsPage, payoutsPageCount]);

  useEffect(() => {
    setWorksPage(1);
    setPayoutsPage(1);
  }, [adminView]);

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.container}>
          <Text style={styles.title}>Адмін</Text>
          <Text style={styles.meta}>Доступ лише для ролі admin.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.metaRow}>
            <Text style={styles.meta} numberOfLines={1}>{user?.email}</Text>
            <Pressable style={styles.logoutChip} onPress={() => logout()}>
              <Ionicons name="log-out-outline" size={14} color="#3158f5" />
              <Text style={styles.logoutChipText}>Вийти</Text>
            </Pressable>
          </View>

          <View style={styles.segmentRow}>
            <Pressable style={[styles.segmentButton, adminView === "works" ? styles.segmentButtonActive : null]} onPress={() => setAdminView("works")}>
              <Text style={[styles.segmentText, adminView === "works" ? styles.segmentTextActive : null]}>Роботи</Text>
            </Pressable>
            <Pressable style={[styles.segmentButton, adminView === "expenses" ? styles.segmentButtonActive : null]} onPress={() => setAdminView("expenses")}>
              <Text style={[styles.segmentText, adminView === "expenses" ? styles.segmentTextActive : null]}>Витрати</Text>
            </Pressable>
          </View>

          <View style={styles.actionsRow}>
            <Pressable style={[styles.secondaryButton, styles.actionButton]} onPress={() => setCategoriesOpen(true)}>
              <Text style={styles.secondaryButtonText}>Категорії</Text>
            </Pressable>
            <Pressable style={[styles.primaryButton, styles.actionButton]} onPress={() => setCreateCategoryOpen(true)}>
              <Text style={styles.primaryButtonText}>+ Додати</Text>
            </Pressable>
          </View>
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
        <>
          {adminView === "works" ? (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Роботи ({works.length})</Text>
              <ScrollView style={{ marginTop: 6 }} contentContainerStyle={{ paddingBottom: 24 }}>
                {works.length === 0 ? <Text style={styles.meta}>Немає робіт у Firestore.</Text> : null}
                {paginatedWorks.map((item) => (
                  <View key={item.id} style={styles.card}>
                    <View style={styles.cardTop}>
                      <Text style={styles.cardTitle}>{item.userEmail}</Text>
                      <Text style={styles.cardMeta}>{item.workDate}</Text>
                    </View>
                    <Text style={styles.cardBody}>{item.categoryName}</Text>
                    <Text style={styles.cardBody}>{item.description}</Text>
                    <Text style={styles.cardAmount}>{item.amount} грн</Text>
                    <View style={styles.cardActions}>
                      <Pressable
                        style={styles.editButton}
                        onPress={() => {
                          setEditWorkId(item.id);
                          setEditDescription(item.description);
                          setEditAmount(String(item.amount ?? 0));
                          setEditOpen(true);
                        }}
                      >
                        <Text style={styles.editButtonText}>Редагувати</Text>
                      </Pressable>
                      <Pressable
                        style={styles.deleteButton}
                        onPress={() => {
                          Alert.alert("Видалити запис?", `Робота від ${item.userEmail} за ${item.workDate}. Цю дію не скасувати.`, [
                            { text: "Ні", style: "cancel" },
                            {
                              text: "Видалити",
                              style: "destructive",
                              onPress: () => {
                                void (async () => {
                                  setLoading(true);
                                  setError(null);
                                  try {
                                    await deleteWorkEntryAdmin(item.id);
                                    if (editWorkId === item.id) {
                                      setEditOpen(false);
                                      setEditWorkId(null);
                                    }
                                    await loadAll();
                                  } catch (e) {
                                    setError(deleteWorkErrorMessage(e));
                                  } finally {
                                    setLoading(false);
                                  }
                                })();
                              },
                            },
                          ]);
                        }}
                      >
                        <Text style={styles.deleteButtonText}>Видалити</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
                {works.length ? (
                  <View style={styles.pagination}>
                    <Pressable style={[styles.secondaryButton, worksPage === 1 ? styles.disabledButton : null]} disabled={worksPage === 1} onPress={() => setWorksPage((p) => Math.max(1, p - 1))}>
                      <Text style={styles.secondaryButtonText}>Назад</Text>
                    </Pressable>
                    <Text style={styles.pageText}>
                      Сторінка {worksPage} / {worksPageCount}
                    </Text>
                    <Pressable
                      style={[styles.secondaryButton, worksPage === worksPageCount ? styles.disabledButton : null]}
                      disabled={worksPage === worksPageCount}
                      onPress={() => setWorksPage((p) => Math.min(worksPageCount, p + 1))}
                    >
                      <Text style={styles.secondaryButtonText}>Далі</Text>
                    </Pressable>
                  </View>
                ) : null}
              </ScrollView>
            </>
          ) : (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Витрати ({payouts.length})</Text>
              <ScrollView style={{ marginTop: 6 }} contentContainerStyle={{ paddingBottom: 24 }}>
                {payouts.length === 0 ? <Text style={styles.meta}>Немає виплат у Firestore (collection `salaryPayouts`).</Text> : null}
                {paginatedPayouts.map((item) => (
                  <View key={item.id} style={styles.card}>
                    <View style={styles.cardTop}>
                      <Text style={styles.cardTitle}>{item.userEmail}</Text>
                      <Text style={styles.cardMeta}>{item.payoutDate}</Text>
                    </View>
                    <Text style={styles.cardBody}>{item.description}</Text>
                    <Text style={styles.cardAmount}>{item.amount} грн</Text>
                  </View>
                ))}
                {payouts.length ? (
                  <View style={styles.pagination}>
                    <Pressable style={[styles.secondaryButton, payoutsPage === 1 ? styles.disabledButton : null]} disabled={payoutsPage === 1} onPress={() => setPayoutsPage((p) => Math.max(1, p - 1))}>
                      <Text style={styles.secondaryButtonText}>Назад</Text>
                    </Pressable>
                    <Text style={styles.pageText}>
                      Сторінка {payoutsPage} / {payoutsPageCount}
                    </Text>
                    <Pressable
                      style={[styles.secondaryButton, payoutsPage === payoutsPageCount ? styles.disabledButton : null]}
                      disabled={payoutsPage === payoutsPageCount}
                      onPress={() => setPayoutsPage((p) => Math.min(payoutsPageCount, p + 1))}
                    >
                      <Text style={styles.secondaryButtonText}>Далі</Text>
                    </Pressable>
                  </View>
                ) : null}
              </ScrollView>
            </>
          )}
        </>
      )}

      <Modal visible={createCategoryOpen} animationType="slide" onRequestClose={() => setCreateCategoryOpen(false)}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Нова категорія</Text>
          <Text style={styles.label}>Назва</Text>
          <TextInput style={styles.input} value={categoryName} onChangeText={setCategoryName} placeholder="Напр. Монтаж" />
          <View style={styles.modalActions}>
            <Pressable style={styles.secondaryButton} onPress={() => setCreateCategoryOpen(false)}>
              <Text style={styles.secondaryButtonText}>Скасувати</Text>
            </Pressable>
            <Pressable
              style={styles.primaryButton}
              onPress={async () => {
                if (!user) return;
                setLoading(true);
                try {
                  await addCategory(categoryName, user.uid);
                  setCategoryName("");
                  setCreateCategoryOpen(false);
                  await loadAll();
                } catch {
                  setError("Не вдалося додати категорію.");
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

      <Modal visible={categoriesOpen} animationType="slide" onRequestClose={() => setCategoriesOpen(false)}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Категорії ({categories.length})</Text>
          <FlatList
            data={categories}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.categoryRow}>
                <Text style={styles.categoryRowText}>{item.name}</Text>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.meta}>Категорій поки немає.</Text>}
          />
          <View style={styles.modalActions}>
            <Pressable style={styles.secondaryButton} onPress={() => setCategoriesOpen(false)}>
              <Text style={styles.secondaryButtonText}>Закрити</Text>
            </Pressable>
            <Pressable
              style={styles.primaryButton}
              onPress={() => {
                setCategoriesOpen(false);
                setCreateCategoryOpen(true);
              }}
            >
              <Text style={styles.primaryButtonText}>+ Додати</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={editOpen} animationType="slide" onRequestClose={() => setEditOpen(false)}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Редагувати роботу</Text>
          <Text style={styles.meta}>{selectedWork ? `${selectedWork.userEmail} • ${selectedWork.workDate}` : ""}</Text>

          <Text style={styles.label}>Опис</Text>
          <TextInput style={[styles.input, styles.textarea]} value={editDescription} onChangeText={setEditDescription} multiline />

          <Text style={styles.label}>Сума (грн)</Text>
          <TextInput style={styles.input} value={editAmount} onChangeText={setEditAmount} keyboardType="numeric" />

          <View style={styles.modalActions}>
            <Pressable style={styles.secondaryButton} onPress={() => setEditOpen(false)}>
              <Text style={styles.secondaryButtonText}>Скасувати</Text>
            </Pressable>
            <Pressable
              style={styles.primaryButton}
              onPress={async () => {
                if (!editWorkId) return;
                setLoading(true);
                try {
                  const parsed = Number(editAmount.replace(",", "."));
                  if (!Number.isFinite(parsed)) throw new Error("invalid amount");
                  await updateWorkEntryAdmin(editWorkId, { amount: parsed, description: editDescription.trim() });
                  setEditOpen(false);
                  await loadAll();
                } catch {
                  setError("Не вдалося зберегти.");
                } finally {
                  setLoading(false);
                }
              }}
            >
              <Text style={styles.primaryButtonText}>Зберегти</Text>
            </Pressable>
          </View>
          <Pressable
            style={styles.modalDeleteLink}
            onPress={() => {
              if (!editWorkId || !selectedWork) return;
              Alert.alert("Видалити запис?", "Цю дію не скасувати.", [
                { text: "Ні", style: "cancel" },
                {
                  text: "Видалити",
                  style: "destructive",
                  onPress: () => {
                    void (async () => {
                      setLoading(true);
                      setError(null);
                      try {
                        await deleteWorkEntryAdmin(editWorkId);
                        setEditOpen(false);
                        setEditWorkId(null);
                        await loadAll();
                      } catch (e) {
                        setError(deleteWorkErrorMessage(e));
                      } finally {
                        setLoading(false);
                      }
                    })();
                  },
                },
              ]);
            }}
          >
            <Text style={styles.modalDeleteLinkText}>Видалити запис</Text>
          </Pressable>
        </View>
      </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f6f8ff" },
  container: { flex: 1, padding: 16, gap: 12, backgroundColor: "#f6f8ff" },
  header: { gap: 10 },
  segmentRow: {
    flexDirection: "row",
    backgroundColor: "#e9eefc",
    borderRadius: 12,
    padding: 4,
    gap: 6,
  },
  segmentButton: {
    flex: 1,
    borderRadius: 9,
    paddingVertical: 9,
    alignItems: "center",
  },
  segmentButtonActive: {
    backgroundColor: "#ffffff",
  },
  segmentText: {
    color: "#5f6a82",
    fontWeight: "800",
  },
  segmentTextActive: {
    color: "#3158f5",
  },
  actionsRow: { flexDirection: "row", gap: 10 },
  actionButton: { flex: 1 },
  title: { fontSize: 22, fontWeight: "800", color: "#0b1220" },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  meta: { color: "#5b6475", marginTop: 2 },
  logoutChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: "#dbe1ef",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#fff",
  },
  logoutChipText: { color: "#3158f5", fontWeight: "800", fontSize: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  error: { color: "#ce2e2e", textAlign: "center" },
  sectionTitle: { marginTop: 6, fontWeight: "900", color: "#0b1220" },
  categoryRow: { backgroundColor: "#fff", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#e7ecfb", marginBottom: 10 },
  categoryRowText: { fontWeight: "800", color: "#0b1220" },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: "#e7ecfb" },
  cardTop: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 10 },
  cardTitle: { fontWeight: "900", color: "#0b1220" },
  cardMeta: { color: "#5b6475", fontSize: 12 },
  cardBody: { marginTop: 6, color: "#1a2740" },
  cardAmount: { marginTop: 10, fontWeight: "900", color: "#0b1220" },
  cardActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10, alignItems: "center" },
  editButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#dbe1ef",
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
  },
  editButtonText: { color: "#3158f5", fontWeight: "800" },
  deleteButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#f5c2c2",
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: "#fff5f5",
  },
  deleteButtonText: { color: "#b42318", fontWeight: "800" },
  modalDeleteLink: { marginTop: 8, paddingVertical: 8, alignItems: "center" },
  modalDeleteLinkText: { color: "#b42318", fontWeight: "800", textDecorationLine: "underline" },
  primaryButton: { backgroundColor: "#3158f5", borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, alignItems: "center" },
  primaryButtonText: { color: "#fff", fontWeight: "800" },
  secondaryButton: { backgroundColor: "#ffffff", borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, alignItems: "center", borderWidth: 1, borderColor: "#dbe1ef" },
  secondaryButtonText: { color: "#3158f5", fontWeight: "800" },
  modalContainer: { flex: 1, padding: 16, gap: 10, backgroundColor: "#fff" },
  modalTitle: { fontSize: 20, fontWeight: "800", marginBottom: 6 },
  label: { color: "#5b6475", fontWeight: "700" },
  input: { borderWidth: 1, borderColor: "#dbe1ef", borderRadius: 12, padding: 12, backgroundColor: "#fff" },
  textarea: { minHeight: 100, textAlignVertical: "top" },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 10 },
  pagination: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 8, marginBottom: 6 },
  pageText: { color: "#5b6475", fontWeight: "700" },
  disabledButton: { opacity: 0.45 },
});

