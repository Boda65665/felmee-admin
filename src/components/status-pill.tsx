import { Info } from "lucide-react";

import { cn } from "@/lib/utils";

/** Визуальные метаданные пилюли статуса: подпись, цвет и наличие иконки-инфо. */
export interface StatusPillMeta {
  label: string;
  /** Классы фона/текста пилюли (напр. `bg-success-bg text-success-fg`). */
  cls: string;
  /** Показывать ли иконку-инфо справа от подписи. */
  info?: boolean;
}

/**
 * Презентационная пилюля статуса с цветной точкой (общая разметка для бейджей
 * аккаунта, записи, операции и т.п.). Семантику статуса — набор значений и
 * их отображение — держит каждый домен у себя, сюда приходит готовая мета.
 */
export const StatusPill = ({ label, cls, info }: StatusPillMeta) => {
  return (
    <span
      data-slot="status-pill"
      title={label}
      className={cn(
        "inline-flex w-fit max-w-full items-center gap-2 rounded-full px-3 py-2 text-sm font-bold leading-tight tracking-tight md:px-4",
        cls,
      )}
    >
      <span className="size-1.5 shrink-0 rounded-full bg-current" />
      <span className="min-w-0 truncate">{label}</span>
      {info && <Info className="size-4 shrink-0" />}
    </span>
  );
};
