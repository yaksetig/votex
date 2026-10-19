import { CheckCircle2, Circle } from "lucide-react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { cn } from "@/lib/utils";

interface BallotOptionsProps {
  options: [string, string];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Associates the group with the panel heading. */
  labelledBy: string;
}

/**
 * The two ballot choices as a radio group. No counts here on purpose: the
 * running result (when the election shows one) lives in the sidebar, so the
 * choice is made without a bandwagon cue inside the control itself.
 */
export function BallotOptions({ options, value, onChange, disabled, labelledBy }: BallotOptionsProps) {
  return (
    <RadioGroupPrimitive.Root
      value={value}
      onValueChange={onChange}
      disabled={disabled}
      aria-labelledby={labelledBy}
      className="grid gap-4 sm:grid-cols-2"
    >
      {options.map((option, index) => {
        const selected = value === option;
        const letter = index === 0 ? "A" : "B";
        return (
          <RadioGroupPrimitive.Item
            key={`${letter}-${option}`}
            value={option}
            className={cn(
              "group relative flex min-h-32 flex-col rounded-xl border p-6 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
              selected
                ? "border-surface-tint bg-primary-fixed shadow-ledger"
                : "border-outline-variant bg-surface-container-lowest hover:border-surface-tint/50"
            )}
          >
            <span className="flex items-start justify-between gap-3">
              <span className="ledger-eyebrow">Option {letter}</span>
              <span className="shrink-0 text-surface-tint" aria-hidden="true">
                {selected ? <CheckCircle2 className="h-6 w-6" aria-hidden="true" /> : <Circle className="h-6 w-6 text-outline-variant" aria-hidden="true" />}
              </span>
            </span>
            <span className="mt-3 block font-headline text-2xl font-bold text-primary">{option}</span>
            <span className="mt-auto block pt-4 text-xs font-semibold uppercase tracking-eyebrow text-on-surface-variant">
              {selected ? "Selected" : "Select"}
            </span>
          </RadioGroupPrimitive.Item>
        );
      })}
    </RadioGroupPrimitive.Root>
  );
}
