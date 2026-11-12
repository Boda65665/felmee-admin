import { ErrorPopup } from "@/components/error-popup";
import { X } from "lucide-react";
import { useRef, useState } from "react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useBlockReasons } from "@/lib/api";
import { cn } from "@/lib/utils";

const OTHER = "Другое";

/** Опция «Другое» — бэкенд её не возвращает, добавляем в UI. */
const OTHER_REASON = {
  reason: OTHER,
  description: "Если ничего не подходит из списка выше, напишите другую причину",
};

/**
 * Модалка блокировки клиента (макет 5350-6464) — выбор причины из справочника
 * `GET /api/admin/block-reasons?target=CLIENT` (+ добавленная в UI опция
 * «Другое»); для «Другое» появляется обязательное поле «Причина». Снизу —
 * необязательный комментарий (не отображается у клиента). Эндпоинт `block`
 * принимает один свободный текст `reason` (1–1000): в него уходит выбранная
 * причина (или текст «Другое»), а комментарий — через тире. Блокировка обратима,
 * поэтому кнопка брендовая. Промис из `onConfirm` держит кнопку в состоянии
 * блокировки; при reject показывается ошибка и модалка остаётся открытой.
 */
export function BlockUserDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void | Promise<void>;
}) {
  const reasonsQuery = useBlockReasons("CLIENT");
  // Причины из справочника + добавленная в UI опция «Другое» (бэкенд её не отдаёт).
  const reasons = [...(reasonsQuery.data ?? []), OTHER_REASON];

  const [selected, setSelected] = useState<string | null>(null);
  const [otherReason, setOtherReason] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | Error | null>(null);
  const wasOpen = useRef(false);

  if (open && !wasOpen.current) {
    setSelected(null);
    setOtherReason("");
    setComment("");
    setSubmitting(false);
    setError(null);
  }
  wasOpen.current = open;

  const isOther = selected === OTHER;
  const canConfirm =
    selected !== null && (!isOther || otherReason.trim() !== "") && !submitting;

  const handleConfirm = async () => {
    if (!canConfirm || selected === null) return;
    const base = isOther ? otherReason.trim() : selected;
    const note = comment.trim();
    const reason = (note ? `${base} — ${note}` : base).slice(0, 1000);
    setError(null);
    setSubmitting(true);
    try {
      await onConfirm(reason);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err : "Не удалось заблокировать");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="flex max-h-[calc(100svh-2rem)] w-full max-w-[600px] flex-col gap-5 overflow-y-auto rounded-[24px] border-grey-4 bg-white px-4 py-5 sm:px-10 sm:py-8 shadow-[0_16px_24px_rgba(0,0,0,0.18)] ring-0"
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-4">
            <DialogTitle className="min-w-0 break-words text-xl sm:text-2xl font-semibold tracking-tight text-ink">
              Заблокировать клиента
            </DialogTitle>
            <DialogClose
              aria-label="Закрыть"
              className="flex size-10 shrink-0 items-center justify-center rounded-lg mt-1 shrink-0 text-ink transition-opacity hover:opacity-70"
            >
              <X className="size-4" />
            </DialogClose>
          </div>
          <DialogDescription className="text-base leading-[1.4] text-ink-muted">
            Клиент не сможет записываться к мастерам. Это действие обратимо —
            разблокировать можно в любой момент.
          </DialogDescription>
        </div>

        <p className="text-base font-medium leading-[1.3] text-ink">
          Выберите причину блокировки:
        </p>

        <div className="flex flex-col gap-2">
          {reasonsQuery.isError && (
            <span className="text-sm text-ink-muted">Данные не загружены.</span>
          )}

          <RadioGroup
            value={selected ?? ""}
            onValueChange={setSelected}
            className="flex w-full flex-col gap-1"
          >
            {reasons.map((reason) => (
              <label
                key={reason.reason}
                className="flex w-full cursor-pointer items-start gap-3 rounded-xl px-1 py-2 transition-colors hover:bg-grey-5"
              >
                <RadioGroupItem value={reason.reason} className="mt-0.5" />
                <span className="flex flex-col">
                  <span className="text-base leading-[1.3] text-ink">
                    {reason.reason}
                  </span>
                  <span className="text-sm leading-[1.3] text-ink-muted">
                    {reason.description}
                  </span>
                </span>
              </label>
            ))}
          </RadioGroup>

          {/* Для «Другое» — обязательное поле причины (появляется по выбору). */}
          {isOther && (
            <input
              type="text"
              value={otherReason}
              onChange={(event) => setOtherReason(event.target.value)}
              maxLength={1000}
              placeholder="Причина"
              className="w-full rounded-xl border border-grey-1 bg-white px-4 py-3 text-base leading-[1.3] text-ink outline-none transition-colors placeholder:text-grey-1 focus:border-brand"
            />
          )}
        </div>

        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          maxLength={1000}
          placeholder="Можно оставить дополнительный комментарий (он не отобразится у клиента)"
          className="h-32 w-full shrink-0 resize-none rounded-xl border border-grey-1 bg-white px-4 py-3 text-base leading-[1.3] text-ink outline-none transition-colors placeholder:text-grey-1 focus:border-brand"
        />

        <ErrorPopup error={error} onDismiss={() => setError(null)} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DialogClose className="flex h-12 flex-1 items-center justify-center rounded-xl border border-ink/20 bg-white text-sm font-medium text-ink transition-colors hover:bg-grey-5">
            Отмена
          </DialogClose>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={cn(
              "flex h-12 flex-1 items-center justify-center rounded-xl text-sm font-medium transition-colors",
              canConfirm
                ? "cursor-pointer bg-brand text-white hover:opacity-90"
                : "cursor-not-allowed bg-grey-3 text-white",
            )}
          >
            {submitting ? "Блокировка…" : "Заблокировать"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
