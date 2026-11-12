import { cn } from "@/lib/utils";

/**
 * Выбор времени по паттерну shadcn (Date Picker → Time Picker): стилизованный
 * нативный `<input type="time">` (нативный дропдаун браузера, скрытая
 * webkit-иконка календаря). Значение — строка `HH:mm`. `step` в секундах
 * (напр. 1 — с секундами; по умолчанию минуты).
 */
export function TimePicker({
  value,
  onChange,
  step,
  className,
}: {
  value?: string;
  onChange: (value: string) => void;
  step?: number;
  className?: string;
}) {
  return (
    <input
      type="time"
      value={value}
      step={step}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-12 rounded-xl border border-grey-3 bg-white px-3.5 text-base text-ink outline-none transition-colors focus:border-brand",
        "appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none",
        className,
      )}
    />
  );
}
