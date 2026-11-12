/** Формат млн ₽: 10.3 → «10,3», 2 → «2» (без лишних нулей, запятая-разделитель). */
export function formatMillions(value: number): string {
  return value.toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}

/** Остатки Felmee уже передаются в целых рублях. Отсутствующие суммы не равны нулю. */
export function formatRubles(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) return "—";
  return `${value.toLocaleString("ru-RU")} ₽`;
}
