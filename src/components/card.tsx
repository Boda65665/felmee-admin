import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/** Базовая карточка админки: белый фон, серая рамка, скругление 28, паддинг 32. */
export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "min-w-0 shrink-0 rounded-[20px] border border-grey-4 bg-white p-4 sm:rounded-[28px] sm:p-6 xl:p-8",
        className,
      )}
      {...props}
    />
  );
}
