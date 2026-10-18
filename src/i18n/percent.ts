// Values are percentage points: 30.4 means 30.4%, not 3040%.
export function percent(value: number | null | undefined, lang: "tr" | "en", maximumFractionDigits = 2, minimumFractionDigits = 0) {
  if (value == null || !Number.isFinite(value)) return "";
  return new Intl.NumberFormat(lang === "en" ? "en-GB" : "tr-TR", {
    style: "percent", maximumFractionDigits, minimumFractionDigits, useGrouping: false,
  }).format(value / 100);
}
