
import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full rounded-xl border border-outline-variant/20 bg-surface-container-low px-4 py-3 text-base text-on-surface ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-on-surface-variant/70 focus-visible:border-surface-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface-tint/15 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 transition-all md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
