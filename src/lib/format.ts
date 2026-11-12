/** Формат млн ₽: 10.3 → «10,3», 2 → «2» (без лишних нулей, запятая-разделитель). */
export function formatMillions(value: number): string {
  return value.toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}
