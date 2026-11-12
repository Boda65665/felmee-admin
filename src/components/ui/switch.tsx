import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Тумблер на Radix Switch. Геометрия из макета: трек 45×28, кнопка 20px,
 * брендовый во включённом состоянии. Управляется `checked` + `onCheckedChange`.
 */
function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-7 w-[45px] shrink-0 cursor-pointer items-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-brand data-[state=unchecked]:bg-grey-3",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-5 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-[21px] data-[state=unchecked]:translate-x-1"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
