export type DateFilterPreset = "all" | "year" | "month" | "range";

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

