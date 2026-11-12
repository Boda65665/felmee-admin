import type { FilterFn, Row } from "@tanstack/react-table";

/**
 * Утилиты таблиц на @tanstack/react-table — общие для всех экранов со списками.
 * Меню заголовков (сортировка/фильтры) — в `components/table-controls`.
 */

/** Фильтр колонки по набору выбранных значений (город/статус/роль/менеджер). */
export const includesSelected = <T,>(
  row: Row<T>,
  columnId: string,
  value: string[],
): boolean => value.includes(row.getValue(columnId));

// Явная проверка совместимости с сигнатурой FilterFn (для любого T).
includesSelected satisfies FilterFn<unknown>;

/** «₽ 128 000» → 128000, для числовой сортировки денежных колонок. */
export const parseMoney = (value: string): number =>
  Number(value.replace(/\D/g, ""));

/** «12.03.2024» → timestamp, для сортировки колонок с датой ДД.ММ.ГГГГ. */
export const parseRuDate = (value: string): number => {
  const [d, m, y] = value.split(".").map(Number);
  return new Date(y, m - 1, d).getTime();
};
