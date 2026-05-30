import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentPropsWithoutRef<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      data-slot="input"
      className={cn(
        "w-full h-9 px-3 bg-[var(--abu-bg-muted)] border border-[var(--abu-border)] rounded-lg",
        "text-sm text-[var(--abu-text-primary)]",
        "placeholder:text-[var(--abu-text-placeholder)]",
        "focus:outline-none focus:ring-2 focus:ring-[var(--abu-clay-ring)] focus:border-[var(--abu-clay)]",
        "disabled:pointer-events-none disabled:opacity-50",
        "transition-all",
        className
      )}
      {...props}
    />
  )
)

Input.displayName = "Input"

export { Input }
