import React, { createElement, useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../auth/auth-context";
import { listCategories } from "../entities/category/category-service";
import type { Category } from "../entities/category/types";
import {
  createWorkEntry,
  deleteWorkEntryAdmin,
  listWorkEntriesForViewer,
  updateWorkEntryAdmin,
} from "../entities/work/work-service";
import { listSalaryPayoutsForViewer } from "../entities/payout/payout-service";
import type { SalaryPayout } from "../entities/payout/types";
import { getRequestAuthUid } from "../lib/request-auth";
import type { WorkEntry } from "../entities/work/types";
import { firestoreActionError } from "../shared/firestore-errors";
import { dateFilterSummaryLabel, matchesDateString, type DateFilterPreset } from "../shared/date-filter";
import { DateInputWithCalendar } from "../components/date-input-with-calendar";
import { EmployeeBalanceCard } from "../components/employee-balance-card";

/** Локальна дата YYYY-MM-DD без зсуву через UTC. */
function formatLocalYMD(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isValidWorkDateYMD(s: string): boolean {
  const t = s.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return false;
  const [yy, mm, dd] = t.split("-").map(Number);
  const d = new Date(yy, mm - 1, dd);
  return !Number.isNaN(d.getTime()) && d.getFullYear() === yy && d.getMonth() === mm - 1 && d.getDate() === dd;
}

function validateCreateWorkForm(
  workDate: string,
  formCategoryId: string,
  description: string,
  categories: Category[],
): string | null {
  const missing: string[] = [];
  if (!isValidWorkDateYMD(workDate)) missing.push("дату");
  const hasCategory = Boolean(formCategoryId.trim()) && categories.some((c) => c.id === formCategoryId);
  if (!hasCategory) missing.push("категорію");
  if (!description.trim()) missing.push("опис");
  if (missing.length === 0) return null;
  if (missing.length === 1) return `Вкажіть ${missing[0]}.`;
  if (missing.length === 2) return `Вкажіть ${missing[0]} та ${missing[1]}.`;
  return `Вкажіть ${missing[0]}, ${missing[1]} та ${missing[2]}.`;
}

/** Лише для фільтра «Період»: нативний календар обирає день. Рік/місяць — окремі списки. */
type RangeDateTarget = "from" | "to";

const YEAR_PICKER_BACK = 25;
const YEAR_PICKER_FORWARD = 5;

const UK_MONTHS = [
  { m: 1, label: "Січень" },
  { m: 2, label: "Лютий" },
  { m: 3, label: "Березень" },
  { m: 4, label: "Квітень" },
  { m: 5, label: "Травень" },
  { m: 6, label: "Червень" },
  { m: 7, label: "Липень" },
  { m: 8, label: "Серпень" },
  { m: 9, label: "Вересень" },
  { m: 10, label: "Жовтень" },
  { m: 11, label: "Листопад" },
  { m: 12, label: "Грудень" },
] as const;

export function WorksScreen() {
  const { user, logout } = useAuth();
  const PAGE_SIZE = 5;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<WorkEntry[]>([]);
  /** Лише employee: виплати для підрахунку «зароблено / виплачено / залишок». */
  const [employeePayouts, setEmployeePayouts] = useState<SalaryPayout[]>([]);

  const [datePreset, setDatePreset] = useState<DateFilterPreset>("all");
  const [dateYear, setDateYear] = useState(() => String(new Date().getFullYear()));
  const [dateMonth, setDateMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  /** Нативний календар лише для «Період» (від / до). */
  const [calendarTarget, setCalendarTarget] = useState<RangeDateTarget | null>(null);
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [monthPickerYear, setMonthPickerYear] = useState(() => new Date().getFullYear());
  const [page, setPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [createModalError, setCreateModalError] = useState<string | null>(null);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [workDate, setWorkDate] = useState(today);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState<string>("");
  /** Лише admin: обмежити список робіт одним userId; "" = усі. */
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>("");
  const [employeeFilterPickerOpen, setEmployeeFilterPickerOpen] = useState(false);
  const [formCategoryId, setFormCategoryId] = useState<string>("");
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  /** Фільтр / нова робота / редагування — одна модалка списку категорій. */
  const [categoryPickerFor, setCategoryPickerFor] = useState<"filter" | "form" | "edit">("filter");

  const [editWorkOpen, setEditWorkOpen] = useState(false);
  const [editWorkId, setEditWorkId] = useState<string | null>(null);
  const [editWorkDate, setEditWorkDate] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");

  const selectedCategory = useMemo(() => categories.find((c) => c.id === formCategoryId) ?? null, [categories, formCategoryId]);
  const selectedEditCategory = useMemo(() => categories.find((c) => c.id === editCategoryId) ?? null, [categories, editCategoryId]);

  /** Унікальні працівники з завантажених робіт (для фільтра admin). */
  const employeeFilterOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const w of items) {
      if (!map.has(w.userId)) map.set(w.userId, w.userEmail);
    }
    return Array.from(map, ([userId, email]) => ({ userId, email })).sort((a, b) =>
      a.email.localeCompare(b.email, "uk"),
    );
  }, [items]);

  const employeeFilterListData = useMemo(
    () => [{ userId: "", email: "Усі працівники" }, ...employeeFilterOptions],
    [employeeFilterOptions],
  );

  const yearPickerYears = useMemo(() => {
    const cy = new Date().getFullYear();
    const list: number[] = [];
    for (let y = cy + YEAR_PICKER_FORWARD; y >= cy - YEAR_PICKER_BACK; y--) list.push(y);
    return list;
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesCategory = filterCategoryId ? item.categoryId === filterCategoryId : true;
      const matchesEmployee = filterEmployeeId ? item.userId === filterEmployeeId : true;
      const matchesDate = matchesDateString(item.workDate, datePreset, dateYear, dateMonth, dateFrom, dateTo);
      return matchesCategory && matchesEmployee && matchesDate;
    });
  }, [dateFrom, dateMonth, datePreset, dateTo, dateYear, filterCategoryId, filterEmployeeId, items]);

  const filteredTotal = useMemo(() => filteredItems.reduce((acc, item) => acc + (item.amount ?? 0), 0), [filteredItems]);

  const employeeBalance = useMemo(() => {
    if (user?.role !== "employee") return null;
    const earned = filteredItems.reduce((s, i) => s + (i.amount ?? 0), 0);
    const paidOut = employeePayouts
      .filter((p) => matchesDateString(p.payoutDate, datePreset, dateYear, dateMonth, dateFrom, dateTo))
      .reduce((s, p) => s + (p.amount ?? 0), 0);
    return {
      earned,
      paidOut,
      periodLabel: dateFilterSummaryLabel(datePreset, dateYear, dateMonth, dateFrom, dateTo),
    };
  }, [user?.role, filteredItems, employeePayouts, datePreset, dateYear, dateMonth, dateFrom, dateTo]);
  const pageCount = useMemo(() => Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE)), [filteredItems.length]);
  const paginatedItems = useMemo(() => {
    const from = (page - 1) * PAGE_SIZE;
    return filteredItems.slice(from, from + PAGE_SIZE);
  }, [filteredItems, page]);

  useEffect(() => {
    setPage(1);
  }, [datePreset, dateYear, dateMonth, dateFrom, dateTo, filterCategoryId, filterEmployeeId]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  async function reloadWorkItemsOnly(): Promise<void> {
    if (!user) return;
    const expectedUid = user.uid;
    const role = user.role;
    try {
      const works = await listWorkEntriesForViewer({ uid: expectedUid, role });
      if (getRequestAuthUid() !== expectedUid) return;
      setItems(works);
      if (role === "employee") {
        const payouts = await listSalaryPayoutsForViewer({ uid: expectedUid, role });
        if (getRequestAuthUid() !== expectedUid) return;
        setEmployeePayouts(payouts);
      }
    } catch {
      setError("Не вдалося оновити список робіт.");
    }
  }

  async function loadAll() {
    if (!user) return;
    const expectedUid = user.uid;
    setError(null);
    setLoading(true);
    try {
      if (user.role === "employee") {
        const [cats, works, payouts] = await Promise.all([
          listCategories(),
          listWorkEntriesForViewer({ uid: user.uid, role: user.role }),
          listSalaryPayoutsForViewer({ uid: user.uid, role: user.role }),
        ]);
        if (getRequestAuthUid() !== expectedUid) return;
        setCategories(cats);
        setItems(works);
        setEmployeePayouts(payouts);
        if (!formCategoryId && cats[0]) setFormCategoryId(cats[0].id);
      } else {
        const [cats, works] = await Promise.all([listCategories(), listWorkEntriesForViewer({ uid: user.uid, role: user.role })]);
        if (getRequestAuthUid() !== expectedUid) return;
        setCategories(cats);
        setItems(works);
        setEmployeePayouts([]);
        if (!formCategoryId && cats[0]) setFormCategoryId(cats[0].id);
      }
    } catch (e) {
      setError("Не вдалося завантажити дані.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user) {
      setItems([]);
      setEmployeePayouts([]);
      setCategories([]);
      setFormCategoryId("");
      setError(null);
      return;
    }
    setFormCategoryId("");
    setItems([]);
    setEmployeePayouts([]);
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, user?.role]);

  useEffect(() => {
    if (user?.role !== "admin") setFilterEmployeeId("");
  }, [user?.role]);

  useEffect(() => {
    if (createOpen) setCreateModalError(null);
  }, [workDate, description, formCategoryId, createOpen]);

  const applyRangePickedDate = useCallback((date: Date, target: RangeDateTarget) => {
    if (target === "from") setDateFrom(formatLocalYMD(date));
    else setDateTo(formatLocalYMD(date));
  }, []);

  function openYearPicker() {
    setYearPickerOpen(true);
  }

  function openMonthPicker() {
    const m = dateMonth.trim();
    if (/^\d{4}-\d{2}$/.test(m)) {
      setMonthPickerYear(Number(m.split("-")[0]));
    } else {
      setMonthPickerYear(new Date().getFullYear());
    }
    setMonthPickerOpen(true);
  }

  function openRangeDatePicker(target: RangeDateTarget) {
    if (target === "from") {
      const f = dateFrom.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(f)) {
        const [yy, mm, dd] = f.split("-").map(Number);
        setCalendarDate(new Date(yy, mm - 1, dd));
      } else {
        setCalendarDate(new Date());
      }
    } else {
      const t = dateTo.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
        const [yy, mm, dd] = t.split("-").map(Number);
        setCalendarDate(new Date(yy, mm - 1, dd));
      } else {
        setCalendarDate(new Date());
      }
    }
    setCalendarTarget(target);
  }

  function commitRangeCalendar() {
    if (calendarTarget) applyRangePickedDate(calendarDate, calendarTarget);
    setCalendarTarget(null);
  }

  const onAndroidCalendarChange = useCallback(
    (event: DateTimePickerEvent, date?: Date) => {
      const target = calendarTarget;
      if (event.type === "dismissed") {
        setCalendarTarget(null);
        return;
      }
      if (date && target) applyRangePickedDate(date, target);
      setCalendarTarget(null);
    },
    [applyRangePickedDate, calendarTarget],
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.topRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>Роботи</Text>
          </View>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => {
              setCreateModalError(null);
              setCreateOpen(true);
            }}
          >
            <View style={styles.buttonContentRow}>
              <Ionicons name="add-circle-outline" size={18} color="#3158f5" />
              <Text style={styles.secondaryButtonText}>Додати</Text>
            </View>
          </Pressable>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.meta} numberOfLines={1}>{user?.email}</Text>
          <Pressable style={styles.secondaryButton} onPress={() => logout()}>
            <View style={styles.buttonContentRow}>
              <Ionicons name="log-out-outline" size={18} color="#3158f5" />
              <Text style={styles.secondaryButtonText}>Вийти</Text>
            </View>
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
        <FlatList
          style={styles.listFlex}
          data={paginatedItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={paginatedItems.length ? undefined : styles.emptyContainer}
          ListHeaderComponent={
            <View style={styles.filters}>
              {employeeBalance ? (
                <EmployeeBalanceCard
                  earned={employeeBalance.earned}
                  paidOut={employeeBalance.paidOut}
                  periodLabel={employeeBalance.periodLabel}
                />
              ) : null}
              <View style={styles.row}>
                <Pressable
                  style={[styles.picker, styles.rowGrow]}
                  onPress={() => {
                    setCategoryPickerFor("filter");
                    setCategoryPickerOpen(true);
                  }}
                >
                  <Text style={styles.pickerText}>
                    {filterCategoryId ? categories.find((c) => c.id === filterCategoryId)?.name ?? "Категорія" : "Усі категорії"}
                  </Text>
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

              {user?.role === "admin" ? (
                <Pressable
                  style={styles.picker}
                  onPress={() => setEmployeeFilterPickerOpen(true)}
                >
                  <Text style={styles.pickerText}>
                    {filterEmployeeId
                      ? employeeFilterOptions.find((e) => e.userId === filterEmployeeId)?.email ?? "Працівник"
                      : "Усі працівники"}
                  </Text>
                </Pressable>
              ) : null}

              {datePreset === "year" ? (
                <View style={styles.inputWithIconRow}>
                  <TextInput
                    style={[styles.input, styles.inputInRow]}
                    value={dateYear}
                    onChangeText={setDateYear}
                    placeholder="Рік (YYYY)"
                    keyboardType="number-pad"
                  />
                  <Pressable style={styles.calendarIconButton} onPress={openYearPicker} accessibilityLabel="Обрати рік зі списку">
                    <Ionicons name="list-outline" size={22} color="#3158f5" />
                  </Pressable>
                </View>
              ) : null}
              {datePreset === "month" ? (
                <View style={styles.inputWithIconRow}>
                  <TextInput
                    style={[styles.input, styles.inputInRow]}
                    value={dateMonth}
                    onChangeText={setDateMonth}
                    placeholder="Місяць (YYYY-MM)"
                    autoCapitalize="none"
                  />
                  <Pressable style={styles.calendarIconButton} onPress={openMonthPicker} accessibilityLabel="Обрати місяць зі списку">
                    <Ionicons name="grid-outline" size={22} color="#3158f5" />
                  </Pressable>
                </View>
              ) : null}
              {datePreset === "range" ? (
                <View style={styles.row}>
                  <View style={[styles.inputWithIconRow, styles.rowGrow]}>
                    <TextInput
                      style={[styles.input, styles.inputInRow]}
                      value={dateFrom}
                      onChangeText={setDateFrom}
                      placeholder="Від (YYYY-MM-DD)"
                      autoCapitalize="none"
                    />
                    <Pressable style={styles.calendarIconButton} onPress={() => openRangeDatePicker("from")} accessibilityLabel="Обрати дату «від» у календарі">
                      <Ionicons name="calendar-outline" size={22} color="#3158f5" />
                    </Pressable>
                  </View>
                  <View style={[styles.inputWithIconRow, styles.rowGrow]}>
                    <TextInput
                      style={[styles.input, styles.inputInRow]}
                      value={dateTo}
                      onChangeText={setDateTo}
                      placeholder="До (YYYY-MM-DD)"
                      autoCapitalize="none"
                    />
                    <Pressable style={styles.calendarIconButton} onPress={() => openRangeDatePicker("to")} accessibilityLabel="Обрати дату «до» у календарі">
                      <Ionicons name="calendar-outline" size={22} color="#3158f5" />
                    </Pressable>
                  </View>
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
              await reloadWorkItemsOnly();
            } finally {
              setRefreshing(false);
            }
          }}
          refreshing={refreshing}
          ListEmptyComponent={<Text style={styles.emptyText}>Поки що немає записів. Натисни “Додати”.</Text>}
          ListFooterComponent={
            filteredItems.length ? (
              <View style={styles.pagination}>
                <Pressable style={[styles.secondaryButton, page === 1 ? styles.disabledButton : null]} disabled={page === 1} onPress={() => setPage((p) => Math.max(1, p - 1))}>
                  <Text style={styles.secondaryButtonText}>Назад</Text>
                </Pressable>
                <Text style={styles.pageText}>
                  Сторінка {page} / {pageCount}
                </Text>
                <Pressable
                  style={[styles.secondaryButton, page === pageCount ? styles.disabledButton : null]}
                  disabled={page === pageCount}
                  onPress={() => setPage((p) => Math.min(pageCount, p + 1))}
                >
                  <Text style={styles.secondaryButtonText}>Далі</Text>
                </Pressable>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const canModify = user?.role === "admin";
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle}>{item.categoryName}</Text>
                  <Text style={styles.cardMeta}>{item.workDate}</Text>
                </View>
                {user?.role === "admin" ? <Text style={styles.cardUserEmail}>{item.userEmail}</Text> : null}
                <Text style={styles.cardBody}>{item.description}</Text>
                <Text style={styles.cardAmount}>{item.amount} грн</Text>
                {canModify ? (
                  <View style={styles.cardActions}>
                    <Pressable
                      style={styles.secondaryButton}
                      onPress={() => {
                        setEditWorkId(item.id);
                        setEditWorkDate(item.workDate);
                        setEditDescription(item.description);
                        setEditAmount(String(item.amount ?? 0));
                        setEditCategoryId(item.categoryId);
                        setEditWorkOpen(true);
                      }}
                    >
                      <Text style={styles.secondaryButtonText}>Редагувати</Text>
                    </Pressable>
                    <Pressable
                      style={styles.secondaryButtonDanger}
                      onPress={() => {
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
                                  await deleteWorkEntryAdmin(item.id);
                                  if (editWorkId === item.id) {
                                    setEditWorkOpen(false);
                                    setEditWorkId(null);
                                  }
                                  void reloadWorkItemsOnly();
                                } catch (e) {
                                  setError(firestoreActionError(e, "Не вдалося видалити запис."));
                                } finally {
                                  setLoading(false);
                                }
                              })();
                            },
                          },
                        ]);
                      }}
                    >
                      <Text style={styles.secondaryButtonDangerText}>Видалити</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      )}

      <Modal
        visible={createOpen}
        animationType="slide"
        onRequestClose={() => {
          setCreateModalError(null);
          setCreateOpen(false);
        }}
      >
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Нова робота</Text>

          <Text style={styles.label}>Дата (YYYY-MM-DD)</Text>
          <DateInputWithCalendar value={workDate} onDateChange={setWorkDate} placeholder="2026-04-02" />

          <Text style={styles.label}>Категорія</Text>
          <Pressable
            style={styles.picker}
            onPress={() => {
              setCategoryPickerFor("form");
              setCategoryPickerOpen(true);
            }}
          >
            <Text style={styles.pickerText}>{selectedCategory?.name ?? "Оберіть категорію"}</Text>
          </Pressable>

          <Text style={styles.label}>Опис</Text>
          <TextInput style={[styles.input, styles.textarea]} value={description} onChangeText={setDescription} placeholder="Що зроблено?" multiline />

          {user?.role === "admin" ? (
            <>
              <Text style={styles.label}>Сума (грн, необов’язково)</Text>
              <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="0" />
            </>
          ) : (
            <Text style={styles.hintMuted}>Суму нарахування встановлює адміністратор.</Text>
          )}

          {createModalError ? <Text style={styles.modalFormError}>{createModalError}</Text> : null}

          <View style={styles.modalActions}>
            <Pressable
              style={[styles.secondaryButton, styles.modalActionButton]}
              onPress={() => {
                setCreateModalError(null);
                setCreateOpen(false);
              }}
            >
              <Text style={styles.secondaryButtonText}>Скасувати</Text>
            </Pressable>
            <Pressable
              style={[styles.secondaryButton, styles.modalActionButton, loading ? styles.disabledButton : null]}
              disabled={loading}
              onPress={async () => {
                if (!user) return;
                const validationError = validateCreateWorkForm(workDate, formCategoryId, description, categories);
                if (validationError) {
                  setCreateModalError(validationError);
                  return;
                }
                const category = categories.find((c) => c.id === formCategoryId);
                if (!category) {
                  setCreateModalError("Оберіть категорію зі списку.");
                  return;
                }
                setLoading(true);
                try {
                  const amountPayload =
                    user.role === "admin" && amount.trim()
                      ? Number(amount.replace(",", "."))
                      : undefined;
                  await createWorkEntry({
                    userId: user.uid,
                    userEmail: user.email,
                    workDate: workDate.trim(),
                    description: description.trim(),
                    categoryId: category.id,
                    categoryName: category.name,
                    amount: amountPayload,
                  });
                  setCreateModalError(null);
                  setCreateOpen(false);
                  setDescription("");
                  setAmount("");
                  void reloadWorkItemsOnly();
                } catch {
                  setError("Не вдалося створити запис.");
                } finally {
                  setLoading(false);
                }
              }}
            >
              <Text style={styles.secondaryButtonText}>Зберегти</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={editWorkOpen} animationType="slide" onRequestClose={() => setEditWorkOpen(false)}>
        <ScrollView style={styles.editScroll} contentContainerStyle={styles.editScrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.modalTitle}>Редагувати роботу</Text>

          <Text style={styles.label}>Дата (YYYY-MM-DD)</Text>
          <DateInputWithCalendar value={editWorkDate} onDateChange={setEditWorkDate} placeholder="2026-04-02" />

          <Text style={styles.label}>Категорія</Text>
          <Pressable
            style={styles.picker}
            onPress={() => {
              setCategoryPickerFor("edit");
              setCategoryPickerOpen(true);
            }}
          >
            <Text style={styles.pickerText}>{selectedEditCategory?.name ?? "Оберіть категорію"}</Text>
          </Pressable>

          <Text style={styles.label}>Опис</Text>
          <TextInput style={[styles.input, styles.textarea]} value={editDescription} onChangeText={setEditDescription} multiline />

          <Text style={styles.label}>Сума (грн)</Text>
          <TextInput style={styles.input} value={editAmount} onChangeText={setEditAmount} keyboardType="numeric" />

          <View style={styles.modalActions}>
            <Pressable
              style={[styles.secondaryButton, styles.modalActionButton]}
              onPress={() => {
                setEditWorkOpen(false);
                setEditWorkId(null);
              }}
            >
              <Text style={styles.secondaryButtonText}>Скасувати</Text>
            </Pressable>
            <Pressable
              style={[styles.secondaryButton, styles.modalActionButton]}
              onPress={async () => {
                if (!user || !editWorkId) return;
                const category = categories.find((c) => c.id === editCategoryId);
                if (!category) {
                  setError("Оберіть категорію.");
                  return;
                }
                setLoading(true);
                try {
                  const parsed = Number(editAmount.replace(",", "."));
                  if (!Number.isFinite(parsed)) throw new Error("invalid amount");
                  await updateWorkEntryAdmin(editWorkId, {
                    workDate: editWorkDate.trim(),
                    description: editDescription.trim(),
                    amount: parsed,
                    categoryId: category.id,
                    categoryName: category.name,
                  });
                  setEditWorkOpen(false);
                  setEditWorkId(null);
                  void reloadWorkItemsOnly();
                } catch (e) {
                  setError(firestoreActionError(e, "Не вдалося зберегти зміни."));
                } finally {
                  setLoading(false);
                }
              }}
            >
              <Text style={styles.secondaryButtonText}>Зберегти</Text>
            </Pressable>
          </View>
        </ScrollView>
      </Modal>

      <Modal visible={categoryPickerOpen} transparent animationType="fade" onRequestClose={() => setCategoryPickerOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setCategoryPickerOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>
              {categoryPickerFor === "filter"
                ? "Фільтр: категорія"
                : categoryPickerFor === "form"
                  ? "Категорія для запису"
                  : "Категорія"}
            </Text>
            <FlatList
              data={
                categoryPickerFor === "filter"
                  ? ([{ id: "", name: "Усі категорії" } as Category, ...categories])
                  : categories
              }
              keyExtractor={(item, index) => item.id || `all-${index}`}
              renderItem={({ item }) => {
                const rowActive =
                  categoryPickerFor === "filter"
                    ? item.id === filterCategoryId
                    : categoryPickerFor === "form"
                      ? item.id === formCategoryId
                      : item.id === editCategoryId;
                return (
                  <Pressable
                    style={[styles.sheetRow, rowActive ? styles.sheetRowActive : null]}
                    onPress={() => {
                      if (categoryPickerFor === "filter") {
                        setFilterCategoryId(item.id);
                      } else if (categoryPickerFor === "form") {
                        setFormCategoryId(item.id);
                      } else {
                        setEditCategoryId(item.id);
                      }
                      setCategoryPickerOpen(false);
                    }}
                  >
                    <Text style={styles.sheetRowText}>{item.name}</Text>
                  </Pressable>
                );
              }}
            />
          </View>
        </Pressable>
      </Modal>

      <Modal visible={employeeFilterPickerOpen} transparent animationType="fade" onRequestClose={() => setEmployeeFilterPickerOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setEmployeeFilterPickerOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Фільтр: працівник</Text>
            <FlatList
              data={employeeFilterListData}
              keyExtractor={(item) => item.userId || "all"}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.sheetRow, item.userId === filterEmployeeId ? styles.sheetRowActive : null]}
                  onPress={() => {
                    setFilterEmployeeId(item.userId);
                    setEmployeeFilterPickerOpen(false);
                  }}
                >
                  <Text style={styles.sheetRowText}>{item.email}</Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>

      <Modal visible={yearPickerOpen} transparent animationType="fade" onRequestClose={() => setYearPickerOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setYearPickerOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Оберіть рік</Text>
            <FlatList
              data={yearPickerYears}
              keyExtractor={(y) => String(y)}
              renderItem={({ item: y }) => (
                <Pressable
                  style={[styles.sheetRow, String(y) === dateYear.trim() ? styles.sheetRowActive : null]}
                  onPress={() => {
                    setDateYear(String(y));
                    setYearPickerOpen(false);
                  }}
                >
                  <Text style={styles.sheetRowText}>{y}</Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>

      <Modal visible={monthPickerOpen} transparent animationType="fade" onRequestClose={() => setMonthPickerOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setMonthPickerOpen(false)}>
          <View style={[styles.sheet, styles.monthPickerSheet]}>
            <Text style={styles.sheetTitle}>Оберіть місяць</Text>
            <View style={styles.monthPickerYearRow}>
              <Pressable style={styles.monthNavButton} onPress={() => setMonthPickerYear((p) => p - 1)} hitSlop={8}>
                <Ionicons name="chevron-back" size={22} color="#3158f5" />
              </Pressable>
              <Text style={styles.monthPickerYearText}>{monthPickerYear}</Text>
              <Pressable style={styles.monthNavButton} onPress={() => setMonthPickerYear((p) => p + 1)} hitSlop={8}>
                <Ionicons name="chevron-forward" size={22} color="#3158f5" />
              </Pressable>
            </View>
            <View style={styles.monthGrid}>
              {UK_MONTHS.map((item) => {
                const value = `${monthPickerYear}-${String(item.m).padStart(2, "0")}`;
                const active = dateMonth.trim() === value;
                return (
                  <Pressable
                    key={item.m}
                    style={[styles.monthCell, active ? styles.monthCellActive : null]}
                    onPress={() => {
                      setDateMonth(value);
                      setMonthPickerOpen(false);
                    }}
                  >
                    <Text style={[styles.monthCellText, active ? styles.monthCellTextActive : null]} numberOfLines={2}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Pressable>
      </Modal>

      {Platform.OS === "ios" && calendarTarget !== null ? (
        <Modal transparent animationType="slide" visible onRequestClose={() => setCalendarTarget(null)}>
          <Pressable style={styles.calendarModalOverlay} onPress={() => setCalendarTarget(null)}>
            <Pressable style={styles.calendarSheet} onPress={(e) => e.stopPropagation()}>
              <DateTimePicker
                value={calendarDate}
                mode="date"
                display="inline"
                locale="uk-UA"
                onChange={(_, d) => {
                  if (d) setCalendarDate(d);
                }}
              />
              <View style={styles.calendarActions}>
                <Pressable style={[styles.secondaryButton, styles.calendarActionButton]} onPress={() => setCalendarTarget(null)}>
                  <Text style={styles.secondaryButtonText}>Скасувати</Text>
                </Pressable>
                <Pressable style={[styles.secondaryButton, styles.calendarActionButton]} onPress={commitRangeCalendar}>
                  <Text style={styles.secondaryButtonText}>Готово</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
      {Platform.OS === "android" && calendarTarget !== null ? (
        <DateTimePicker
          value={calendarDate}
          mode="date"
          display="default"
          locale="uk-UA"
          onChange={onAndroidCalendarChange}
        />
      ) : null}
      {Platform.OS === "web" && calendarTarget !== null ? (
        <Modal transparent animationType="fade" visible onRequestClose={() => setCalendarTarget(null)}>
          <Pressable style={styles.calendarModalOverlay} onPress={() => setCalendarTarget(null)}>
            <Pressable style={styles.calendarSheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.webDateInputWrap}>
                {createElement("input", {
                  type: "date",
                  value: formatLocalYMD(calendarDate),
                  onChange: (e: { target: { value: string } }) => {
                    const v = e.target.value;
                    if (!v) return;
                    const d = new Date(`${v}T12:00:00`);
                    if (!Number.isNaN(d.getTime())) setCalendarDate(d);
                  },
                  style: {
                    width: "100%",
                    fontSize: 18,
                    padding: 14,
                    borderRadius: 12,
                    border: "1px solid #dbe1ef",
                    boxSizing: "border-box" as const,
                  },
                } as Record<string, unknown>)}
              </View>
              <View style={styles.calendarActions}>
                <Pressable style={[styles.secondaryButton, styles.calendarActionButton]} onPress={() => setCalendarTarget(null)}>
                  <Text style={styles.secondaryButtonText}>Скасувати</Text>
                </Pressable>
                <Pressable style={[styles.secondaryButton, styles.calendarActionButton]} onPress={commitRangeCalendar}>
                  <Text style={styles.secondaryButtonText}>Готово</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f6f8ff" },
  container: { flex: 1, padding: 16, gap: 12, backgroundColor: "#f6f8ff" },
  header: { gap: 8 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  headerLeft: { flex: 1 },
  title: { fontSize: 22, fontWeight: "800", color: "#0b1220" },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 2 },
  meta: { color: "#5b6475", marginTop: 2, flex: 1, marginRight: 8 },
  buttonContentRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  error: { color: "#ce2e2e", textAlign: "center" },
  emptyContainer: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  emptyText: { color: "#5b6475", textAlign: "center" },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: "#e7ecfb" },
  cardTop: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 10 },
  cardTitle: { fontWeight: "800", color: "#0b1220" },
  cardMeta: { color: "#5b6475", fontSize: 12 },
  cardBody: { marginTop: 6, color: "#1a2740" },
  cardUserEmail: { marginTop: 4, color: "#5b6475", fontSize: 12 },
  cardAmount: { marginTop: 10, fontWeight: "800", color: "#0b1220" },
  cardActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  editScroll: { flex: 1, backgroundColor: "#fff" },
  editScrollContent: { padding: 16, gap: 10, paddingBottom: 32 },
  secondaryButton: {
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#dbe1ef",
  },
  secondaryButtonText: { color: "#3158f5", fontWeight: "800" },
  secondaryButtonDanger: {
    alignSelf: "flex-start",
    backgroundColor: "#fff5f5",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#f5c2c2",
  },
  secondaryButtonDangerText: { color: "#b42318", fontWeight: "800" },
  modalContainer: { flex: 1, padding: 16, gap: 10, backgroundColor: "#fff" },
  modalTitle: { fontSize: 20, fontWeight: "800", marginBottom: 6 },
  modalFormError: { color: "#ce2e2e", fontWeight: "700", fontSize: 14, textAlign: "center", marginTop: 4 },
  label: { color: "#5b6475", fontWeight: "700" },
  hintMuted: { color: "#64748b", fontSize: 13, lineHeight: 18 },
  input: { borderWidth: 1, borderColor: "#dbe1ef", borderRadius: 12, padding: 12, backgroundColor: "#fff" },
  inputWithIconRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  inputInRow: { flex: 1, minWidth: 0 },
  calendarIconButton: {
    borderWidth: 1,
    borderColor: "#dbe1ef",
    borderRadius: 12,
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 10,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  calendarModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  calendarSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 8,
    overflow: "hidden",
  },
  calendarActions: {
    flexDirection: "row",
    gap: 10,
    alignItems: "stretch",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#e7ecfb",
  },
  calendarActionButton: { flex: 1, alignSelf: "stretch" },
  webDateInputWrap: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  textarea: { minHeight: 90, textAlignVertical: "top" },
  picker: {
    borderWidth: 1,
    borderColor: "#dbe1ef",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "#fff",
    justifyContent: "center",
  },
  pickerText: { color: "#3158f5", fontWeight: "800" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 10, alignItems: "stretch" },
  modalActionButton: { flex: 1, alignSelf: "stretch" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 14, maxHeight: "70%" },
  monthPickerSheet: { maxHeight: "85%" },
  sheetTitle: { fontWeight: "800", fontSize: 16, marginBottom: 10 },
  monthPickerYearRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginBottom: 14,
    paddingVertical: 4,
  },
  monthNavButton: {
    borderWidth: 1,
    borderColor: "#dbe1ef",
    borderRadius: 12,
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 10,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  monthPickerYearText: { fontSize: 22, fontWeight: "800", color: "#0b1220", minWidth: 72, textAlign: "center" },
  monthGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "space-between", paddingBottom: 8 },
  monthCell: {
    width: "31%",
    borderWidth: 1,
    borderColor: "#dbe1ef",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 6,
    backgroundColor: "#fff",
    alignItems: "center",
  },
  monthCellActive: { borderColor: "#3158f5", backgroundColor: "#eef2ff" },
  monthCellText: { fontWeight: "700", fontSize: 13, color: "#0b1220", textAlign: "center" },
  monthCellTextActive: { color: "#3158f5" },
  sheetRow: { paddingVertical: 12, paddingHorizontal: 10, borderRadius: 12 },
  sheetRowActive: { backgroundColor: "#eef2ff" },
  sheetRowText: { fontWeight: "700", color: "#0b1220" },
  listFlex: { flex: 1 },
  filters: { gap: 10, marginBottom: 12 },
  row: { flexDirection: "row", gap: 10, alignItems: "center" },
  rowGrow: { flex: 1 },
  totalBanner: { backgroundColor: "#0b1220", borderRadius: 12, padding: 12, flexDirection: "row", justifyContent: "space-between" },
  totalLabel: { color: "#cbd5f5", fontWeight: "800" },
  totalValue: { color: "#fff", fontWeight: "900" },
  pagination: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 8, marginBottom: 6 },
  pageText: { color: "#5b6475", fontWeight: "700" },
  disabledButton: { opacity: 0.45 },
});

