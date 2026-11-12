import { X } from "lucide-react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Модалка просмотра причины отклонения (только чтение) — открывается по клику
 * на причину у отклонённой заявки. Показывает полный текст и кнопку «Закрыть».
 */
export function RejectionReasonViewDialog({
  open,
  onOpenChange,
  reason,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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

        <div className="w-full rounded-[10px] border border-grey-4 p-3 text-sm leading-normal text-ink">
          {reason}
        </div>

        <DialogClose className="flex w-full items-center justify-center rounded-[10px] border border-grey-4 bg-white px-[18px] py-3 text-sm font-semibold text-ink transition-colors hover:bg-grey-5">
          Закрыть
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
