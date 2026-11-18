import type { ComponentType } from "react";

import { cn } from "@/lib/utils";

/**
 * Квадратная кнопка действия по строке (46×46, рамка) с иконкой Lucide.
 * Общий примитив для таблиц: просмотр/редактирование/блокировка и т.п.
 */
export const IconButton = ({
  icon: Icon,
  label,
  onClick,
  disabled,
  className,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) => {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex size-[46px] shrink-0 items-center justify-center rounded-xl border border-grey-4 text-ink transition-colors hover:bg-grey-5",
        className,
      )}
    >
      <Icon className="size-4" />
    </button>
  );
};
