export type DateFilterPreset = "all" | "year" | "month" | "range";

const UK_MONTH_NAMES = [
  "Січень",
  "Лютий",
  "Березень",
  "Квітень",
  "Травень",
  "Червень",
  "Липень",
  "Серпень",
  "Вересень",
  "Жовтень",
  "Листопад",
  "Грудень",
] as const;

/** Напр. `2026-04` → «Квітень 2026». */
export function formatYearMonthUkrainian(ym: string): string {
  const t = ym.trim();
  if (!/^\d{4}-\d{2}$/.test(t)) return t;
  const parts = t.split("-");
  const yy = parts[0] ?? "";
  const mo = Number(parts[1]);
  if (mo >= 1 && mo <= 12) {
    return `${UK_MONTH_NAMES[mo - 1]} ${yy}`;
  }
  return t;
}

/**
 * Короткий текст для UI: який період обрано у фільтрі дат.
 */
export function dateFilterSummaryLabel(
  preset: DateFilterPreset,
  yearStr: string,
  monthValue: string,
  from: string,
  to: string,
): string {
  if (preset === "all") return "Усі дати";
  if (preset === "year") {
    const y = yearStr.trim();
    return y ? `Рік ${y}` : "Рік";
  }
  if (preset === "month") {
    const m = monthValue.trim();
    if (/^\d{4}-\d{2}$/.test(m)) {
      const parts = m.split("-");
      const yy = parts[0] ?? "";
      const mo = Number(parts[1]);
      if (mo >= 1 && mo <= 12) {
        return `${UK_MONTH_NAMES[mo - 1]} ${yy}`;
      }
    }
    return m ? `Місяць ${m}` : "Місяць";
  }
  if (preset === "range") {
    const f = from.trim();
    const t = to.trim();
    if (f && t) return `${f} — ${t}`;
    if (f) return `Від ${f}`;
    if (t) return `До ${t}`;
    return "Період";
  }
  return "Усі дати";
}

/** `isoDate` у форматі YYYY-MM-DD. */
export function matchesDateString(
  isoDate: string,
  preset: DateFilterPreset,
  yearStr: string,
  monthValue: string,
  from: string,
  to: string,
): boolean {
  if (preset === "all") return true;
  if (preset === "year") {
    const y = yearStr.trim();
    if (!y) return true;
    return isoDate.startsWith(`${y}-`);
  }
  if (preset === "month") {
    if (!monthValue) return true;
    return isoDate.startsWith(monthValue);
  }
  if (preset === "range") {
    if (from && isoDate < from) return false;
    if (to && isoDate > to) return false;
    return true;
  }
  return true;
}

