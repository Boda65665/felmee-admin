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

/**
 * Модалка подтверждения удаления уведомления/рассылки — открывается по корзине
 * в строке. Красная «Удалить» вызывает `onConfirm`; промис держит кнопку в
 * состоянии удаления, при reject показывается ошибка и модалка остаётся открытой.
 */
export function ConfirmDeleteNotificationDialog({
  open,
  onOpenChange,
  isBroadcast = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Рассылка (иначе — уведомление) — влияет только на подписи. */
  isBroadcast?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | Error | null>(null);
  const wasOpen = useRef(false);

  if (open && !wasOpen.current) {
    setSubmitting(false);
    setError(null);
  }
  wasOpen.current = open;

  const noun = isBroadcast ? "рассылку" : "уведомление";

  const handleConfirm = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err : "Не удалось удалить");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex w-full max-w-[452px] flex-col gap-6 rounded-[24px] border-grey-4 bg-white px-4 py-5 sm:px-10 sm:py-8 text-ink shadow-[0_16px_24px_rgba(0,0,0,0.18)] ring-0"
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <DialogTitle className="min-w-0 break-words text-xl sm:text-2xl font-semibold tracking-tight text-ink">
              Удалить {noun}
            </DialogTitle>
            <DialogClose
              aria-label="Закрыть"
              className="flex size-10 shrink-0 items-center justify-center rounded-lg text-ink transition-opacity hover:opacity-70"
            >
              <X className="size-4" />
            </DialogClose>
          </div>
          <DialogDescription className="text-base leading-[1.4] text-ink-muted">
            Вы действительно хотите удалить {noun}? Данное действие нельзя будет
            отменить.
          </DialogDescription>
        </div>
        <ErrorPopup error={error} onDismiss={() => setError(null)} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DialogClose className="flex h-12 flex-1 items-center justify-center rounded-xl border border-grey-2 text-base font-medium text-ink transition-colors hover:bg-grey-5">
            Отмена
          </DialogClose>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="flex h-12 flex-1 items-center justify-center rounded-xl bg-danger text-base font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Удаление…" : "Удалить"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
