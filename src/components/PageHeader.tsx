import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  /** Small label above the title: the section the page belongs to. */
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  /** Actions aligned to the end of the header on wide screens. */
  actions?: ReactNode;
  className?: string;
}

/**
 * The one page header: eyebrow, h1, optional description and actions. Pages
 * compose it instead of hand-rolling the same block with drifting spacing.
 */
export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-6 border-b border-outline-variant pb-8 md:flex-row md:items-end md:justify-between", className)}>
      <div className="max-w-3xl">
        {eyebrow ? <p className="ledger-eyebrow text-secondary">{eyebrow}</p> : null}
        <h1 className="mt-3 font-headline text-3xl font-bold tracking-display text-primary sm:text-4xl">{title}</h1>
        {description ? <div className="mt-4 max-w-2xl text-base leading-7 text-on-surface-variant">{description}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </header>
  );
}
