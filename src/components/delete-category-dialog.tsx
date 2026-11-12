import { X } from "lucide-react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Инфо-модалка «Нельзя удалить категорию» — открывается по корзине на карточке
 * категории, в которой есть услуги. Только сообщение и кнопка «Понятно».
 */
export function DeleteCategoryDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex w-full max-w-[440px] flex-col gap-3 rounded-[24px] border-grey-4 bg-white px-4 py-5 sm:px-10 sm:py-8 text-center text-ink shadow-[0_16px_24px_rgba(0,0,0,0.18)] ring-0"
      >
        <DialogClose
          aria-label="Закрыть"
          className="absolute right-3 top-3 flex size-10 items-center justify-center rounded-lg text-ink-muted transition-opacity hover:opacity-70"
        >
          <X className="size-4" />
        </DialogClose>
        <DialogTitle className="min-w-0 break-words pt-8 text-xl font-semibold tracking-tight text-ink sm:text-2xl">
          Нельзя удалить категорию
        </DialogTitle>
        <DialogDescription className="text-base leading-[1.4] text-ink-muted">
          В этой категории есть услуги. Сначала удалите или переместите их в
          другую.
        </DialogDescription>
        <DialogClose className="mt-3 flex h-12 w-full items-center justify-center rounded-full bg-black text-base text-white transition-opacity hover:opacity-90">
          Понятно
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
