import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.05em]",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary-container text-on-secondary-container",
        destructive: "border-transparent bg-error-container text-on-error-container",
        outline: "border-outline-variant bg-surface-container-low text-on-surface-variant",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

// Badges are static labels, so they render as spans with no focus styles.
function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

// Variant helpers intentionally share the generated component module.
// eslint-disable-next-line react-refresh/only-export-components
export { Badge, badgeVariants }
