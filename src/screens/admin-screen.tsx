import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuth } from "../auth/auth-context";
import { addCategory, listCategories } from "../entities/category/category-service";
import type { Category } from "../entities/category/types";
import { listAllWorkEntries, updateWorkEntryAdmin } from "../entities/work/work-service";
import type { WorkEntry } from "../entities/work/types";

export function AdminScreen() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [works, setWorks] = useState<WorkEntry[]>([]);

  const [createCategoryOpen, setCreateCategoryOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editWorkId, setEditWorkId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editAmount, setEditAmount] = useState("");

  const selectedWork = useMemo(() => works.find((w) => w.id === editWorkId) ?? null, [works, editWorkId]);

  async function loadAll() {
    if (!user || !isAdmin) return;
    setError(null);
    setLoading(true);
    try {
      const [cats, allWorks] = await Promise.all([listCategories(), listAllWorkEntries()]);
      setCategories(cats);
      setWorks(allWorks);
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

  if (!isAdmin) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Адмін</Text>
        <Text style={styles.meta}>Доступ лише для ролі admin.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Адмін</Text>
          <Text style={styles.meta}>{user?.email}</Text>
        </View>
        <Pressable style={styles.primaryButton} onPress={() => setCreateCategoryOpen(true)}>
          <Text style={styles.primaryButtonText}>+ Категорія</Text>
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
        <>
          <Text style={styles.sectionTitle}>Категорії ({categories.length})</Text>
          <FlatList
            data={categories}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
            renderItem={({ item }) => (
              <View style={styles.pill}>
                <Text style={styles.pillText}>{item.name}</Text>
              </View>
            )}
          />

          <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Роботи ({works.length})</Text>
          <FlatList
            data={works}
            keyExtractor={(item) => item.id}
            style={{ marginTop: 6 }}
            renderItem={({ item }) => (
              <Pressable
                style={styles.card}
                onPress={() => {
                  setEditWorkId(item.id);
                  setEditDescription(item.description);
                  setEditAmount(String(item.amount ?? 0));
                  setEditOpen(true);
                }}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle}>{item.userEmail}</Text>
                  <Text style={styles.cardMeta}>{item.workDate}</Text>
                </View>
                <Text style={styles.cardBody}>{item.categoryName}</Text>
                <Text style={styles.cardBody}>{item.description}</Text>
                <Text style={styles.cardAmount}>{item.amount} грн</Text>
              </Pressable>
            )}
          />
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
  sectionTitle: { marginTop: 6, fontWeight: "900", color: "#0b1220" },
  pill: { backgroundColor: "#ffffff", borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: "#e7ecfb" },
  pillText: { fontWeight: "800", color: "#0b1220" },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: "#e7ecfb" },
  cardTop: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 10 },
  cardTitle: { fontWeight: "900", color: "#0b1220" },
  cardMeta: { color: "#5b6475", fontSize: 12 },
  cardBody: { marginTop: 6, color: "#1a2740" },
  cardAmount: { marginTop: 10, fontWeight: "900", color: "#0b1220" },
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
});

