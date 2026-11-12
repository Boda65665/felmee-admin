import * as React from "react"
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/** Группа-переключатель на Radix (сегмент-контрол). `type` задаёт консумер. */
function ToggleGroup({
  className,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      className={cn("flex items-center gap-1.5", className)}
      {...props}
    />
  )
}

/** Сегмент группы: стиль активного/неактивного задаёт консумер через className. */
function ToggleGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(
        "cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium leading-none outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand/40 disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { ToggleGroup, ToggleGroupItem }
