import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  id: string;
  label: string;
  /** Marks the field as required in the label and for assistive tech. */
  required?: boolean;
  /** Short helper text shown under the control. */
  hint?: React.ReactNode;
  /** The validation message; wires aria-invalid and aria-describedby on the control. */
  error?: string;
  /** Current length and limit, rendered as a counter next to the hint. */
  counter?: { value: number; max: number };
  className?: string;
  children: (control: {
    id: string;
    "aria-invalid": true | undefined;
    "aria-describedby": string | undefined;
    "aria-required": true | undefined;
  }) => React.ReactNode;
}

/**
 * Label, control, hint, counter and error in one accessible unit. The render
 * prop receives the attributes the control must spread so screen readers
 * announce the error and hint together with the field.
 */
export function FormField({ id, label, required, hint, error, counter, className, children }: FormFieldProps) {
  const hintId = hint || counter ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id} className="ledger-eyebrow flex items-center gap-1">
        {label}
        {required ? (
          <span className="text-error" aria-hidden="true">
            *
          </span>
        ) : null}
      </Label>
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
        "aria-required": required ? true : undefined,
      })}
      {(hint || counter) && (
        <div id={hintId} className="flex items-start justify-between gap-3 text-xs text-on-surface-variant">
          <span>{hint}</span>
          {counter ? (
            <span
              className={cn("shrink-0 tabular-nums", counter.value > counter.max && "font-semibold text-error")}
              aria-label={`${counter.value} of ${counter.max} characters`}
            >
              {counter.value}/{counter.max}
            </span>
          ) : null}
        </div>
      )}
      {error ? (
        <p id={errorId} role="alert" className="text-sm font-medium text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
