import React, { createElement, useCallback, useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextStyle } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";

function formatLocalYMD(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseYMDToLocalDate(s: string): Date | null {
  const t = s.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const [yy, mm, dd] = t.split("-").map(Number);
  const d = new Date(yy, mm - 1, dd);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getFullYear() !== yy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
  return d;
}

export type DateInputWithCalendarProps = {
  value: string;
  onDateChange: (ymd: string) => void;
  placeholder?: string;
  inputStyle?: StyleProp<TextStyle>;
};

/**
 * Поле дати (YYYY-MM-DD) з іконкою календаря: натискання відкриває нативний вибір дати.
 */
export function DateInputWithCalendar({ value, onDateChange, placeholder = "2026-04-11", inputStyle }: DateInputWithCalendarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tempDate, setTempDate] = useState(() => new Date());

  const openPicker = () => {
    setTempDate(parseYMDToLocalDate(value) ?? new Date());
    setPickerOpen(true);
  };

  const cancel = useCallback(() => setPickerOpen(false), []);

  const commit = useCallback(() => {
    onDateChange(formatLocalYMD(tempDate));
    setPickerOpen(false);
  }, [tempDate, onDateChange]);

  const onAndroidChange = useCallback(
    (event: DateTimePickerEvent, date?: Date) => {
      if (event.type === "dismissed") {
        setPickerOpen(false);
        return;
      }
      if (date) onDateChange(formatLocalYMD(date));
      setPickerOpen(false);
    },
    [onDateChange],
  );

  return (
    <>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, styles.inputFlex, inputStyle]}
          value={value}
          onChangeText={onDateChange}
          placeholder={placeholder}
          autoCapitalize="none"
        />
        <Pressable style={styles.iconBtn} onPress={openPicker} accessibilityLabel="Обрати дату в календарі" accessibilityRole="button" hitSlop={4}>
          <Ionicons name="calendar-outline" size={22} color="#3158f5" />
        </Pressable>
      </View>

      {Platform.OS === "ios" && pickerOpen ? (
        <Modal transparent animationType="slide" visible onRequestClose={cancel}>
          <Pressable style={styles.calendarModalOverlay} onPress={cancel}>
            <Pressable style={styles.calendarSheet} onPress={(e) => e.stopPropagation()}>
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="inline"
                locale="uk-UA"
                onChange={(_, d) => {
                  if (d) setTempDate(d);
                }}
              />
              <View style={styles.calendarActions}>
                <Pressable style={[styles.secondaryButton, styles.calendarActionButton]} onPress={cancel}>
                  <Text style={styles.secondaryButtonText}>Скасувати</Text>
                </Pressable>
                <Pressable style={[styles.secondaryButton, styles.calendarActionButton]} onPress={commit}>
                  <Text style={styles.secondaryButtonText}>Готово</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {Platform.OS === "android" && pickerOpen ? (
        <DateTimePicker value={tempDate} mode="date" display="default" locale="uk-UA" onChange={onAndroidChange} />
      ) : null}

      {Platform.OS === "web" && pickerOpen ? (
        <Modal transparent animationType="fade" visible onRequestClose={cancel}>
          <Pressable style={styles.calendarModalOverlay} onPress={cancel}>
            <Pressable style={styles.calendarSheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.webDateInputWrap}>
                {createElement("input", {
                  type: "date",
                  value: formatLocalYMD(tempDate),
                  onChange: (e: { target: { value: string } }) => {
                    const v = e.target.value;
                    if (!v) return;
                    const d = new Date(`${v}T12:00:00`);
                    if (!Number.isNaN(d.getTime())) setTempDate(d);
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
                <Pressable style={[styles.secondaryButton, styles.calendarActionButton]} onPress={cancel}>
                  <Text style={styles.secondaryButtonText}>Скасувати</Text>
                </Pressable>
                <Pressable style={[styles.secondaryButton, styles.calendarActionButton]} onPress={commit}>
                  <Text style={styles.secondaryButtonText}>Готово</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#dbe1ef",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#fff",
  },
  inputFlex: { flex: 1, minWidth: 0 },
  iconBtn: {
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
  secondaryButton: {
    alignSelf: "stretch",
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
});
