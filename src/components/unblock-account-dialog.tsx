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
import type { BlockAccountVariant } from "./block-account-dialog";

const NOUN: Record<BlockAccountVariant, string> = {
  master: "Мастер",
  salon: "Салон",
};

const TITLE: Record<BlockAccountVariant, string> = {
  master: "Разблокировать мастера",
  salon: "Разблокировать салон",
};

/** Вторая строка описания — что снова сможет делать разблокированный. */
const RESTORE: Record<BlockAccountVariant, string> = {
  master:
    "Мастер снова сможет принимать записи и управлять своим графиком.",
  salon: "Салон снова сможет принимать записи и управлять своим графиком.",
};

/**
 * Модалка подтверждения разблокировки мастера/салона (по образцу
 * `UnblockUserDialog`). Показывает, кто (`managerName`, из `blocked_by`) и по
 * какой причине (`reason`, из `block_reason`) заблокировал, и запрос
 * подтверждения. Комментарий декоративный: эндпоинт `unblock` не принимает тело,
 * на бэк не уходит. Промис из `onConfirm` держит кнопку в состоянии
 * разблокировки; при reject показывается ошибка и модалка остаётся открытой.
 */
export function UnblockAccountDialog({
  open,
  onOpenChange,
  variant,
  reason,
  managerName,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: BlockAccountVariant;
  /** Причина прошлой блокировки (из `block_reason`); null — если неизвестна. */
  reason?: string | null;
  /** Менеджер, выполнивший блокировку (`blocked_by.display_name`). */
  managerName?: string | null;
  onConfirm: () => void | Promise<void>;
}) {
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | Error | null>(null);
  const wasOpen = useRef(false);

  if (open && !wasOpen.current) {
    setComment("");
    setSubmitting(false);
    setError(null);
  }
  wasOpen.current = open;

  const handleConfirm = async () => {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err : "Не удалось разблокировать");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="flex w-full max-w-[600px] flex-col gap-5 rounded-[24px] border-grey-4 bg-white px-4 py-5 sm:px-10 sm:py-8 shadow-[0_16px_24px_rgba(0,0,0,0.18)] ring-0"
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-4">
            <DialogTitle className="min-w-0 break-words text-xl sm:text-2xl font-semibold tracking-tight text-ink">
              {TITLE[variant]}
            </DialogTitle>
            <DialogClose
              aria-label="Закрыть"
              className="flex size-10 shrink-0 items-center justify-center rounded-lg mt-1 shrink-0 text-ink transition-opacity hover:opacity-70"
            >
              <X className="size-4" />
            </DialogClose>
          </div>
          <DialogDescription className="flex flex-col gap-3 text-base leading-[1.4] text-ink-muted">
            <span>
              {`${NOUN[variant]} был заблокирован` +
                (managerName ? ` менеджером ${managerName}` : "") +
                (reason ? ` по причине: «${reason}».` : ".")}
            </span>
            <span>Вы уверены, что хотите восстановить доступ? {RESTORE[variant]}</span>
          </DialogDescription>
        </div>

        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          maxLength={1000}
          placeholder="Комментарий (он не отобразится у клиента)"
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
            disabled={submitting}
            className="flex h-12 flex-1 items-center justify-center rounded-xl bg-brand text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Разблокировка…" : "Разблокировать"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
