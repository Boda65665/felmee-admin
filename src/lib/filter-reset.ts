import type { DateRange } from "react-day-picker";

/** Сравниваем дни, поскольку время внутри выбранного дня на фильтрацию не влияет. */
export function hasChangedRange(current: DateRange | undefined, initial: DateRange | undefined): boolean {
  return current?.from?.toDateString() !== initial?.from?.toDateString() ||
    current?.to?.toDateString() !== initial?.to?.toDateString();
}
