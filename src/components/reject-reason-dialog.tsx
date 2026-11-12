import { X } from "lucide-react";
import { useState } from "react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError } from "@/lib/api";

const REASON_MAX = 1000;

/**
 * Модалка «Причина отклонения» — открывается из очереди модерации по
 * «Отклонить с пояснением»: поле причины со счётчиком и отправка. Комментарий
 * обязателен (1–1000). `onSubmit` держит кнопку в состоянии отправки, при
 * ошибке показывает её инлайном; успех закрывает модалку.
 */
export function RejectReasonDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (comment: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Сброс текста/ошибки при закрытии (кроме момента отправки). */
  function handleOpenChange(next: boolean) {
    if (submitting) return;
    if (!next) {
      setReason("");
      setError(null);
    }
    onOpenChange(next);
  }

  async function handleSubmit() {
    const comment = reason.trim();
    if (!comment || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(comment);
      setReason("");
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Не удалось отклонить заявку. Попробуйте ещё раз",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="flex w-full max-w-[428px] flex-col gap-3.5 rounded-2xl border-grey-4 bg-white p-5 text-ink shadow-[0_8px_24px_rgba(0,0,0,0.12)] ring-0"
      >
        <div className="flex items-start justify-between gap-3">
          <DialogTitle className="text-base font-semibold text-ink">
            Причина отклонения
          </DialogTitle>
          <DialogClose
            aria-label="Закрыть"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-ink/40 transition-opacity hover:opacity-70"
          >
            <X className="size-4" />
          </DialogClose>
        </div>

        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={REASON_MAX}
          placeholder="Опишите причину отклонения"
          className="h-[110px] w-full resize-none rounded-[10px] border border-grey-4 p-[11px] text-sm leading-normal text-ink outline-none placeholder:text-ink/40"
        />
        <p className="text-right text-xs text-ink/40">
          {reason.length} / {REASON_MAX}
        </p>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex items-center justify-end gap-3">
          <DialogClose className="flex items-center justify-center rounded-[10px] border border-grey-4 bg-white px-[18px] py-3 text-sm font-semibold text-ink transition-colors hover:bg-grey-5">
            Отмена
          </DialogClose>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!reason.trim() || submitting}
            className="flex items-center justify-center rounded-[10px] bg-[#e15c46] px-[18px] py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? "Отправка…" : "Отправить"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
