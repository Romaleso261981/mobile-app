import React, { createElement, useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../auth/auth-context";
import {
  createSalaryPayout,
  deleteSalaryPayoutAdmin,
  listSalaryPayoutsForViewer,
  updateSalaryPayout,
} from "../entities/payout/payout-service";
import { getRequestAuthUid } from "../lib/request-auth";
import type { SalaryPayout } from "../entities/payout/types";
import { listUsersForAdmin, type UserListItem } from "../entities/user/user-service";
import { firestoreActionError } from "../shared/firestore-errors";
import { matchesDateString, type DateFilterPreset } from "../shared/date-filter";

/** Локальна дата YYYY-MM-DD без зсуву через UTC. */
function formatLocalYMD(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

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

export function ExpensesScreen() {
  const { user, logout } = useAuth();
  const PAGE_SIZE = 5;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<SalaryPayout[]>([]);
  const [employees, setEmployees] = useState<UserListItem[]>([]);
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);

  const [datePreset, setDatePreset] = useState<DateFilterPreset>("all");
  const [dateYear, setDateYear] = useState(() => String(new Date().getFullYear()));
  const [dateMonth, setDateMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [calendarTarget, setCalendarTarget] = useState<RangeDateTarget | null>(null);
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [monthPickerYear, setMonthPickerYear] = useState(() => new Date().getFullYear());
  const [page, setPage] = useState(1);

  const [payoutModal, setPayoutModal] = useState<"none" | "create" | "edit">("none");
  const [editingPayoutId, setEditingPayoutId] = useState<string | null>(null);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [payoutDate, setPayoutDate] = useState(today);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [assigneeEmail, setAssigneeEmail] = useState<string>("");

  function openCreatePayout() {
    if (!user || user.role !== "admin") return;
    setAssigneeId(user.uid);
    setAssigneeEmail(user.email);
    setEditingPayoutId(null);
    setPayoutDate(today);
    setDescription("");
    setAmount("");
    setPayoutModal("create");
  }

  function openEditPayout(item: SalaryPayout) {
    setEditingPayoutId(item.id);
    setPayoutDate(item.payoutDate);
    setDescription(item.description);
    setAmount(String(item.amount ?? 0));
    setPayoutModal("edit");
  }

  function closePayoutModal() {
    setPayoutModal("none");
    setEditingPayoutId(null);
    setEmployeePickerOpen(false);
  }

  const employeeListData = useMemo(() => {
    if (!user || user.role !== "admin") return [];
    const byUid = new Map<string, UserListItem>();
    // 1) користувачі з users/*
    for (const e of employees) {
      if (!e.uid) continue;
      byUid.set(e.uid, { uid: e.uid, email: e.email ?? "", role: e.role });
    }
    // 2) fallback із уже завантажених витрат (щоб список не був порожній)
    for (const item of items) {
      if (!item.userId) continue;
      const prev = byUid.get(item.userId);
      if (!prev || !prev.email) {
        byUid.set(item.userId, { uid: item.userId, email: item.userEmail ?? "", role: prev?.role });
      }
    }
    // 3) поточний admin завжди доступний як мінімум
    byUid.set(user.uid, { uid: user.uid, email: user.email, role: "admin" });
    return Array.from(byUid.values()).sort((a, b) => {
      const aLabel = a.email || a.uid;
      const bLabel = b.email || b.uid;
      return aLabel.localeCompare(bLabel, "uk");
    });
  }, [employees, items, user]);

  const selectedAssigneeLabel = useMemo(() => {
    if (!user) return "Працівник";
    if (user.role !== "admin") return user.email;
    if (assigneeId && assigneeEmail) return assigneeEmail;
    const fromList = employeeListData.find((e) => e.uid === assigneeId);
    if (!fromList) return "Працівник";
    return fromList.email || fromList.uid;
  }, [assigneeEmail, assigneeId, employeeListData, user]);

  const yearPickerYears = useMemo(() => {
    const cy = new Date().getFullYear();
    const list: number[] = [];
    for (let y = cy + YEAR_PICKER_FORWARD; y >= cy - YEAR_PICKER_BACK; y--) list.push(y);
    return list;
  }, []);

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

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      return matchesDateString(item.payoutDate, datePreset, dateYear, dateMonth, dateFrom, dateTo);
    });
  }, [dateFrom, dateMonth, datePreset, dateTo, dateYear, items]);

  const filteredTotal = useMemo(() => filteredItems.reduce((acc, item) => acc + (item.amount ?? 0), 0), [filteredItems]);
  const pageCount = useMemo(() => Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE)), [filteredItems.length]);
  const paginatedItems = useMemo(() => {
    const from = (page - 1) * PAGE_SIZE;
    return filteredItems.slice(from, from + PAGE_SIZE);
  }, [filteredItems, page]);

  useEffect(() => {
    setPage(1);
  }, [datePreset, dateYear, dateMonth, dateFrom, dateTo]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  async function reloadPayoutItemsOnly(): Promise<void> {
    if (!user) return;
    const expectedUid = user.uid;
    const role = user.role;
    try {
      const rows = await listSalaryPayoutsForViewer({ uid: expectedUid, role });
      if (getRequestAuthUid() !== expectedUid) return;
      setItems(rows);
    } catch {
      setError("Не вдалося оновити список виплат.");
    }
  }

  async function loadAll() {
    if (!user) return;
    const expectedUid = user.uid;
    setError(null);
    setLoading(true);
    try {
      const rows = await listSalaryPayoutsForViewer({ uid: user.uid, role: user.role });
      if (getRequestAuthUid() !== expectedUid) return;
      setItems(rows);
      if (user.role === "admin") {
        try {
          const users = await listUsersForAdmin();
          if (getRequestAuthUid() !== expectedUid) return;
          setEmployees(users);
        } catch {
          // Не блокуємо завантаження витрат, якщо список працівників недоступний.
          setEmployees([]);
        }
      }
    } catch {
      setError("Не вдалося завантажити виплати.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user) {
      setItems([]);
      setEmployees([]);
      setAssigneeId("");
      setAssigneeEmail("");
      setError(null);
      return;
    }
    setItems([]);
    setEmployees([]);
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, user?.role]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.topRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>Витрати</Text>
          </View>
          {user?.role === "admin" ? (
            <Pressable style={styles.secondaryButton} onPress={openCreatePayout}>
              <View style={styles.buttonContentRow}>
                <Ionicons name="add-circle-outline" size={18} color="#3158f5" />
                <Text style={styles.secondaryButtonText}>Додати</Text>
              </View>
            </Pressable>
          ) : null}
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
              <Pressable
                style={styles.secondaryButton}
                onPress={() => setDatePreset((prev) => (prev === "all" ? "month" : prev === "month" ? "year" : prev === "year" ? "range" : "all"))}
              >
                <Text style={styles.secondaryButtonText}>
                  {datePreset === "all" ? "Усі дати" : datePreset === "month" ? "Місяць" : datePreset === "year" ? "Рік" : "Період"}
                </Text>
              </Pressable>

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
              await reloadPayoutItemsOnly();
            } finally {
              setRefreshing(false);
            }
          }}
          refreshing={refreshing}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {user?.role === "admin"
                ? "Поки що немає виплат. Натисни “Додати”."
                : "Поки що немає виплат."}
            </Text>
          }
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
                  <Text style={styles.cardTitle}>{item.payoutDate}</Text>
                  <Text style={styles.cardAmount}>{item.amount} грн</Text>
                </View>
                {user?.role === "admin" ? <Text style={styles.cardMeta}>{item.userEmail}</Text> : null}
                <Text style={styles.cardBody}>{item.description}</Text>
                {canModify ? (
                  <View style={styles.cardActions}>
                    <Pressable style={styles.secondaryButton} onPress={() => openEditPayout(item)}>
                      <Text style={styles.secondaryButtonText}>Редагувати</Text>
                    </Pressable>
                    <Pressable
                      style={styles.secondaryButtonDanger}
                      onPress={() => {
                        Alert.alert("Видалити виплату?", "Цю дію не скасувати.", [
                          { text: "Ні", style: "cancel" },
                          {
                            text: "Видалити",
                            style: "destructive",
                            onPress: () => {
                              void (async () => {
                                setLoading(true);
                                setError(null);
                                try {
                                  await deleteSalaryPayoutAdmin(item.id);
                                  if (editingPayoutId === item.id) closePayoutModal();
                                  await loadAll();
                                } catch (e) {
                                  setError(firestoreActionError(e, "Не вдалося видалити виплату."));
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

      <Modal visible={payoutModal !== "none"} animationType="slide" onRequestClose={closePayoutModal}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>{payoutModal === "edit" ? "Редагувати виплату" : "Нова виплата"}</Text>

          {user?.role === "admin" && payoutModal === "create" ? (
            <>
              <Text style={styles.label}>Працівник</Text>
              <Pressable style={styles.picker} onPress={() => setEmployeePickerOpen(true)}>
                <Text style={styles.pickerText}>{selectedAssigneeLabel}</Text>
              </Pressable>
            </>
          ) : null}

          <Text style={styles.label}>Дата (YYYY-MM-DD)</Text>
          <TextInput style={styles.input} value={payoutDate} onChangeText={setPayoutDate} placeholder="2026-04-02" autoCapitalize="none" />

          <Text style={styles.label}>Опис</Text>
          <TextInput style={[styles.input, styles.textarea]} value={description} onChangeText={setDescription} placeholder="За що виплата?" multiline />

          <Text style={styles.label}>Сума (грн)</Text>
          <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="0" />

          <View style={styles.modalActions}>
            <Pressable style={[styles.secondaryButton, styles.modalActionButton]} onPress={closePayoutModal}>
              <Text style={styles.secondaryButtonText}>Скасувати</Text>
            </Pressable>
            <Pressable
              style={[styles.secondaryButton, styles.modalActionButton]}
              onPress={async () => {
                if (!user) return;
                const targetUserId = user.role === "admin" ? assigneeId || user.uid : user.uid;
                const fromList = employeeListData.find((e) => e.uid === targetUserId);
                const targetUserEmail =
                  user.role === "admin"
                    ? assigneeEmail || fromList?.email || user.email
                    : user.email;
                setLoading(true);
                try {
                  const parsed = Number(amount.replace(",", "."));
                  if (!Number.isFinite(parsed)) throw new Error("invalid amount");
                  if (payoutModal === "create") {
                    await createSalaryPayout({
                      userId: targetUserId,
                      userEmail: targetUserEmail,
                      payoutDate: payoutDate.trim(),
                      description: description.trim(),
                      amount: parsed,
                    });
                  } else if (payoutModal === "edit" && editingPayoutId) {
                    await updateSalaryPayout(editingPayoutId, {
                      payoutDate: payoutDate.trim(),
                      description: description.trim(),
                      amount: parsed,
                    });
                  }
                  closePayoutModal();
                  setDescription("");
                  setAmount("");
                  await reloadPayoutItemsOnly();
                } catch {
                  setError(payoutModal === "edit" ? "Не вдалося зберегти зміни." : "Не вдалося створити виплату.");
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

      <Modal visible={employeePickerOpen} transparent animationType="fade" onRequestClose={() => setEmployeePickerOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setEmployeePickerOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Оберіть працівника</Text>
            <FlatList
              data={employeeListData}
              keyExtractor={(item) => item.uid}
              renderItem={({ item }) => {
                const active = item.uid === assigneeId;
                return (
                  <Pressable
                    style={[styles.sheetRow, active ? styles.sheetRowActive : null]}
                    onPress={() => {
                      setAssigneeId(item.uid);
                      setAssigneeEmail(item.email);
                      setEmployeePickerOpen(false);
                    }}
                  >
                    <Text style={styles.sheetRowText}>{item.email || item.uid}</Text>
                  </Pressable>
                );
              }}
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
  cardMeta: { marginTop: 2, color: "#5b6475", fontSize: 12 },
  cardAmount: { fontWeight: "900", color: "#0b1220" },
  cardBody: { marginTop: 6, color: "#1a2740" },
  cardActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
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
  modalActionButton: { flex: 1, alignSelf: "stretch" },
  modalContainer: { flex: 1, padding: 16, gap: 10, backgroundColor: "#fff" },
  modalTitle: { fontSize: 20, fontWeight: "800", marginBottom: 6 },
  label: { color: "#5b6475", fontWeight: "700" },
  input: { borderWidth: 1, borderColor: "#dbe1ef", borderRadius: 12, padding: 12, backgroundColor: "#fff" },
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
  textarea: { minHeight: 90, textAlignVertical: "top" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 10, alignItems: "stretch" },
  listFlex: { flex: 1 },
  filters: { gap: 10, marginBottom: 12 },
  row: { flexDirection: "row", gap: 10, alignItems: "center" },
  rowGrow: { flex: 1 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 14, maxHeight: "70%" },
  monthPickerSheet: { maxHeight: "85%" },
  sheetTitle: { fontWeight: "800", fontSize: 16, marginBottom: 10 },
  sheetRow: { paddingVertical: 12, paddingHorizontal: 10, borderRadius: 12 },
  sheetRowActive: { backgroundColor: "#eef2ff" },
  sheetRowText: { fontWeight: "700", color: "#0b1220" },
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
  totalBanner: { backgroundColor: "#0b1220", borderRadius: 12, padding: 12, flexDirection: "row", justifyContent: "space-between" },
  totalLabel: { color: "#cbd5f5", fontWeight: "800" },
  totalValue: { color: "#fff", fontWeight: "900" },
  pagination: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 8, marginBottom: 6 },
  pageText: { color: "#5b6475", fontWeight: "700" },
  disabledButton: { opacity: 0.45 },
});

