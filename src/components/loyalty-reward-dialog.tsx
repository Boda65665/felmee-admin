import { ErrorPopup } from "@/components/error-popup";
import { X } from "lucide-react";
import { useRef, useState } from "react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Вариант интервала вознаграждения: значение (enum API) + подпись. */
export type RewardIntervalOption = { value: string; label: string };

/**
 * Модалка редактирования награды правила программы лояльности — открывается по
 * карандашу в строке. Заголовок — текст условия; поля «Вознаграждение» (процент
 * 0–100) и «Интервал» (select). `onSave` получает процент и интервал; промис
 * держит кнопку в состоянии отправки, при reject показывается ошибка.
 */
export function LoyaltyRewardDialog({
  open,
  onOpenChange,
  title,
  percent,
  interval,
  intervalOptions,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Текст условия — заголовок модалки. */
  title: string;
  /** Текущий процент вознаграждения. */
  percent: number;
  /** Текущий интервал (значение enum API). */
  interval: string;
  intervalOptions: RewardIntervalOption[];
  onSave?: (percent: number, interval: string) => void | Promise<void>;
}) {
  const [value, setValue] = useState(String(percent));
  const [intervalValue, setIntervalValue] = useState(interval);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | Error | null>(null);
  const wasOpen = useRef(false);

  // Инициализация из props при открытии — в фазе рендера, до отрисовки.
  if (open && !wasOpen.current) {
    setValue(String(percent));
    setIntervalValue(interval);
    setSaving(false);
    setError(null);
  }
  wasOpen.current = open;

  const percentNumber = Number(value);
  const valid =
    value.trim() !== "" &&
    Number.isFinite(percentNumber) &&
    percentNumber >= 0 &&
    percentNumber <= 100 &&
    intervalValue !== "";

  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave?.(percentNumber, intervalValue);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="flex w-full max-w-[440px] flex-col gap-5 rounded-[24px] border-grey-4 bg-white px-4 py-5 sm:px-8 sm:py-7 text-ink shadow-[0_16px_24px_rgba(0,0,0,0.18)] ring-0"
      >
        <div className="flex items-start justify-between gap-4">
          <DialogTitle className="text-xl font-semibold leading-tight tracking-tight text-ink">
            {title}
          </DialogTitle>
          <DialogClose
            aria-label="Закрыть"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg mt-0.5 text-ink-muted transition-opacity hover:opacity-70"
          >
            <X className="size-4" />
          </DialogClose>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-tight text-ink-muted">
            Вознаграждение, %
          </span>
          <input
            type="number"
            min={0}
            max={100}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="h-12 w-full rounded-xl border border-grey-3 bg-white px-3.5 text-base leading-[1.3] text-ink outline-none transition-colors placeholder:text-ink/40 focus:border-brand"
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-tight text-ink-muted">
            Интервал вознаграждения
          </span>
          <Select value={intervalValue} onValueChange={setIntervalValue}>
            <SelectTrigger>
              <SelectValue placeholder="Выберите интервал" />
            </SelectTrigger>
            <SelectContent>
              {intervalOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <ErrorPopup error={error} onDismiss={() => setError(null)} />

        <button
          type="button"
          onClick={save}
          disabled={!valid || saving}
          className="flex h-12 w-full items-center justify-center rounded-xl bg-brand text-base font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Сохранение…" : "Сохранить изменения"}
        </button>
      </DialogContent>
    </Dialog>
  );
}
