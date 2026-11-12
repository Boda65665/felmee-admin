import { useRef, useState } from "react";

import { Dialog, DialogDescription } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  ModalActions,
  ModalButton,
  ModalDivider,
  ModalHeader,
  ModalShell,
} from "./modal-shell";

/** Причины отмены записи (последняя — «Другое» со свободным вводом). */
const REASONS = [
  "Не могу принять в это время",
  "Изменилось расписание",
  "Форс-мажор",
  "Обучение/курсы",
  "Проблемы с услугой",
  "Другое",
] as const;

const OTHER = "Другое";

/**
 * Модалка «Отмена записи» — открывается по «Отмена запись» в просмотре записи.
 * Шаг выбора причины (радио; для «Другое» — поле свободного ввода), затем экран
 * подтверждения «Запись отменена». `onConfirm` получает выбранную причину.
 */
export function AppointmentCancelDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Подтверждение отмены. Промис держит кнопку в состоянии отправки; при reject
   * показывается ошибка и модалка остаётся на шаге выбора причины.
   */
  onConfirm?: (reason: string) => void | Promise<void>;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [otherText, setOtherText] = useState("");
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wasOpen = useRef(false);

  // Сброс при открытии — в фазе рендера, до отрисовки, чтобы не мигало старым
  // содержимым. На закрытии состояние НЕ трогаем: иначе экран «Запись отменена»
  // на кадр сменится формой во время анимации исчезновения.
  if (open && !wasOpen.current) {
    setReason(null);
    setOtherText("");
    setDone(false);
    setSaving(false);
    setError(null);
  }
  wasOpen.current = open;

  // Для «Другое» причина должна быть введена (в API `reason` — minLength 1).
  const canConfirm = reason !== null && (reason !== OTHER || otherText.trim() !== "");

  async function confirm() {
    if (!canConfirm || saving) return;
    const value = reason === OTHER ? otherText.trim() : (reason as string);
    setSaving(true);
    setError(null);
    try {
      await onConfirm?.(value);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отменить запись");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {done ? (
        <ModalShell className="max-w-[652px] gap-2">
          <ModalHeader title="Запись отменена" />
          <DialogDescription className="text-base leading-[1.4] text-ink-muted">
            Клиент уведомлён. Возврат средств оформлен автоматически.
          </DialogDescription>
        </ModalShell>
      ) : (
        <ModalShell className="max-w-[652px]">
          {/* Шапка */}
          <div className="flex w-full flex-col gap-2">
            <ModalHeader title="Отмена записи" />
            <DialogDescription className="text-base leading-[1.4] text-ink-muted">
              Клиент получит уведомление об отмене. При отмене записи клиенту
              возвращается полная стоимость.
            </DialogDescription>
          </div>

          <ModalDivider />

          <p className="text-lg font-medium leading-[1.4] text-ink">
            Уточните причину отмены записи
          </p>

          {/* Причины */}
          <RadioGroup
            value={reason ?? ""}
            onValueChange={setReason}
            className="w-full"
          >
            {REASONS.map((item) => (
              <label
                key={item}
                className="flex w-full cursor-pointer items-center gap-4 rounded-xl px-1 py-2 transition-colors hover:bg-grey-5"
              >
                <RadioGroupItem value={item} />
                <span className="text-base leading-[1.3] text-ink">{item}</span>
              </label>
            ))}
            {reason === OTHER && (
              <textarea
                value={otherText}
                onChange={(event) => setOtherText(event.target.value)}
                placeholder="Опишите причину"
                className="h-[130px] w-full resize-none rounded-xl border border-grey-4 p-3 text-base leading-[1.3] text-ink outline-none placeholder:text-ink/40"
              />
            )}
          </RadioGroup>

          {error && (
            <p className="w-full text-base leading-[1.3] text-danger">{error}</p>
          )}

          <ModalDivider />

          {/* Действия */}
          <ModalActions>
            <ModalButton
              variant="primary"
              disabled={!canConfirm || saving}
              onClick={confirm}
            >
              {saving ? "Отмена…" : "Отменить запись"}
            </ModalButton>
            <ModalButton close>Закрыть</ModalButton>
          </ModalActions>
        </ModalShell>
      )}
    </Dialog>
  );
}
