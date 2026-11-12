import { useState } from "react";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import {
  format,
  startOfDay,
  endOfDay,
  subDays,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
} from "date-fns";
import { ru } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/lib/use-media-query";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type { DateRange };

type Preset = { label: string; getRange: () => DateRange };

/** Быстрые пресеты периода — вычисляются на момент клика. */
const PRESETS: Preset[] = [
  {
    label: "Сегодня",
    getRange: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }),
  },
  {
    label: "7 дней",
    getRange: () => ({
      from: startOfDay(subDays(new Date(), 6)),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: "30 дней",
    getRange: () => ({
      from: startOfDay(subDays(new Date(), 29)),
      to: endOfDay(new Date()),
    }),
  },
  {
    label: "Этот месяц",
    getRange: () => ({
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date()),
    }),
  },
  {
    label: "Квартал",
    getRange: () => ({
      from: startOfQuarter(new Date()),
      to: endOfQuarter(new Date()),
    }),
  },
  {
    label: "Год",
    getRange: () => ({
      from: startOfYear(new Date()),
      to: endOfYear(new Date()),
    }),
  },
];

/** Дефолтный период — последние 30 дней. */
const defaultRange = (): DateRange => ({
  from: startOfDay(subDays(new Date(), 29)),
  to: endOfDay(new Date()),
});

/** Человекочитаемая подпись диапазона: «1 мая 2025 — 30 мая 2025». */
const formatRange = (
  range: DateRange | undefined,
  placeholder: string,
): string => {
  if (!range?.from) return placeholder;
  const from = format(range.from, "d MMM yyyy", { locale: ru });
  if (!range.to) return from;
  return `${from} — ${format(range.to, "d MMM yyyy", { locale: ru })}`;
};

export interface DateFilterProps {
  /** Управляемое значение периода. */
  value?: DateRange;
  /** Начальное значение для неуправляемого режима (по умолчанию — 30 дней). */
  defaultValue?: DateRange;
  /** Вызывается при выборе пресета или диапазона в календаре. */
  onChange?: (range: DateRange | undefined) => void;
  /** Подпись-триггер, когда период не выбран (по умолчанию «Выберите период»). */
  placeholder?: string;
  /**
   * Вид триггера: `default` — кнопка с рамкой; `header` — заголовок колонки
   * таблицы (аплайн-подпись + иконка, брендовая при активном фильтре).
   */
  variant?: "default" | "header";
  /** Подпись заголовка в режиме `header` (напр. «дата оплаты»). */
  label?: string;
  className?: string;
}

/**
 * Фильтр по периоду: кнопка-триггер с выбранным диапазоном → поповер с
 * пресетами (Сегодня/7д/30д/Этот месяц/Квартал/Год) и календарём для
 * произвольного диапазона (react-day-picker, ru-локаль). Работает как в
 * управляемом (`value`+`onChange`), так и в неуправляемом режиме. В режиме
 * `variant="header"` встраивается в заголовок колонки таблицы.
 */
export function DateFilter({
  value,
  defaultValue,
  onChange,
  placeholder = "Выберите период",
  variant = "default",
  label,
  className,
}: DateFilterProps) {
  const [open, setOpen] = useState(false);
  const compact = useMediaQuery("(max-width: 767px)");
  const [internal, setInternal] = useState<DateRange | undefined>(
    defaultValue ?? defaultRange(),
  );

  const isControlled = value !== undefined;
  const range = isControlled ? value : internal;

  const update = (next: DateRange | undefined) => {
    if (!isControlled) setInternal(next);
    onChange?.(next);
  };

  const active = range?.from != null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {variant === "header" ? (
        <PopoverTrigger
          className={cn(
            "flex items-center gap-1.5 text-left uppercase outline-none transition-colors",
            active && "font-semibold text-brand",
            className,
          )}
        >
          {label}
          <CalendarIcon className={cn("size-4", active && "text-brand")} />
        </PopoverTrigger>
      ) : (
        <PopoverTrigger
          className={cn(
            "flex min-h-12 w-fit max-w-full shrink-0 items-center gap-2 rounded-xl border border-grey-4 bg-white px-3 py-2 text-left text-sm font-medium leading-[1.3] tracking-tight text-ink outline-none transition-colors hover:bg-grey-5 sm:px-4 sm:text-base",
            className,
          )}
        >
          <CalendarIcon className="size-4 shrink-0" />
          {formatRange(range, placeholder)}
          <ChevronDown className="size-4 shrink-0" />
        </PopoverTrigger>
      )}

      <PopoverContent align="start" className="flex w-auto flex-col gap-0 p-0 md:flex-row">
        {/* Колонка пресетов */}
        <div className="flex max-w-full flex-wrap gap-1 border-b border-grey-4 p-2 md:flex-col md:border-b-0 md:border-r">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                update(preset.getRange());
                setOpen(false);
              }}
              className="min-h-11 rounded-lg px-3 py-2 text-left text-sm font-medium text-ink transition-colors hover:bg-grey-5"
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Календарь произвольного диапазона */}
        <Calendar
          mode="range"
          className={compact ? "[--cell-size:2.5rem]" : undefined}
          numberOfMonths={compact ? 1 : 2}
          defaultMonth={range?.from}
          selected={range}
          onSelect={update}
          locale={ru}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
