import { X } from "lucide-react";
import type { ReactNode } from "react";

import {
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Общий каркас модалок (пока — экран записей): стандартный `DialogContent`
 * (скруглённая карточка на белом, отступы, тень), плюс шапка с заголовком и
 * крестиком, разделитель и футер действий. `className` задаёт ширину
 * (`max-w-[…]`) и точечные правки (напр. `gap-2` на коротком экране).
 */
export const ModalShell = ({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) => {
  return (
    <DialogContent
      showCloseButton={false}
      aria-describedby={undefined}
      className={cn(
        "flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] flex-col gap-4 overflow-y-auto rounded-[20px] border-grey-4 bg-white px-4 py-5 text-ink shadow-[0_16px_24px_rgba(0,0,0,0.18)] ring-0 sm:max-h-[calc(100dvh-2rem)] sm:w-full sm:gap-6 sm:rounded-[24px] sm:px-10 sm:py-8",
        className,
      )}
    >
      {children}
    </DialogContent>
  );
};

/** Шапка модалки: заголовок (опц. брендовый акцент, напр. «#1213») + крестик. */
export const ModalHeader = ({
  title,
  accent,
}: {
  title: ReactNode;
  /** Акцентная часть заголовка справа от текста (брендовый цвет). */
  accent?: ReactNode;
}) => {
  return (
    <div className="flex w-full items-start justify-between gap-3">
      <DialogTitle className="min-w-0 break-words text-xl font-semibold tracking-tight text-ink sm:text-2xl">
        {title}
        {accent != null && <span className="text-brand"> {accent}</span>}
      </DialogTitle>
      <DialogClose
        aria-label="Закрыть"
        className="-mr-2 -mt-2 flex size-11 shrink-0 items-center justify-center rounded-xl text-ink transition-opacity hover:bg-grey-5"
      >
        <X className="size-4" />
      </DialogClose>
    </div>
  );
};

/** Тонкий горизонтальный разделитель внутри модалки. */
export const ModalDivider = () => <div className="h-px w-full bg-grey-2" />;

/** Ряд-футер действий модалки (кнопки прижаты вправо, растягиваются поровну). */
export const ModalActions = ({ children }: { children: ReactNode }) => (
  <div className="flex w-full flex-col-reverse items-stretch justify-end gap-3 sm:flex-row sm:items-center">{children}</div>
);

/**
 * Кнопка футера модалки. `variant`: `primary` (чёрная) / `secondary` (рамка).
 * `close` — оборачивает в `DialogClose` (закрывает модалку по клику).
 */
export const ModalButton = ({
  variant = "secondary",
  close,
  disabled,
  onClick,
  children,
}: {
  variant?: "primary" | "secondary";
  close?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) => {
  const cls = cn(
    "flex min-h-12 flex-1 items-center justify-center rounded-full px-4 py-2 text-center text-base",
    variant === "primary"
      ? disabled
        ? "cursor-not-allowed bg-grey-3 text-white"
        : "bg-black text-white transition-opacity hover:opacity-90"
      : "border border-grey-2 text-ink transition-colors hover:bg-grey-5",
  );

  if (close) {
    return (
      <DialogClose className={cls} disabled={disabled} onClick={onClick}>
        {children}
      </DialogClose>
    );
  }
  return (
    <button
      type="button"
      className={cls}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
};
