import React, { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/FormField";
import { ELECTION_LIMITS } from "@/components/ElectionForm/schema";
import { formSchema, FormData, ElectionFormProps } from "@/components/ElectionForm/types";
import { describeLocalTimezone, toDateTimeLocalValue } from "@/lib/format";

const DEFAULT_DURATION_DAYS = 7;

function defaultDeadline(): Date {
  const date = new Date();
  date.setDate(date.getDate() + DEFAULT_DURATION_DAYS);
  date.setSeconds(0, 0);
  return date;
}

const ElectionForm: React.FC<ElectionFormProps> = ({ onSubmit, onCancel }) => {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      option1: "",
      option2: "",
      endDate: defaultDeadline(),
      showRunningTally: true,
    },
  });
  const titleRef = useRef<HTMLInputElement | null>(null);
  const titleField = register("title");

  // The composer opens in place; move focus into it so keyboard and
  // screen-reader users land on the first field instead of the trigger.
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const [title, description, option1, option2, showRunningTally] = watch([
    "title",
    "description",
    "option1",
    "option2",
    "showRunningTally",
  ]);

  const minDeadline = toDateTimeLocalValue(new Date(Date.now() + 60_000));

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-8"
      aria-labelledby="create-election-title"
      data-dirty={isDirty || undefined}
      noValidate
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="ledger-eyebrow text-secondary">New election</p>
          <h2 id="create-election-title" className="mt-2 font-headline text-2xl font-semibold text-primary">
            Create an election
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-on-surface-variant">
            Ask one question with two answers. Anyone verified with World ID can vote, and every ballot is public
            under the voter&apos;s pseudonym.
          </p>
        </div>
        <p className="text-xs text-on-surface-variant">
          <span className="text-error" aria-hidden="true">*</span> Required
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_360px]">
        <div className="space-y-6">
          <div className="ledger-panel p-6">
            <FormField
              id="title"
              label="Election title"
              required
              error={errors.title?.message}
              counter={{ value: title?.length ?? 0, max: ELECTION_LIMITS.title.max }}
            >
              {(a11y) => (
                <Input
                  {...titleField}
                  {...a11y}
                  ref={(element) => {
                    titleField.ref(element);
                    titleRef.current = element;
                  }}
                  placeholder="Community garden budget 2027"
                  maxLength={ELECTION_LIMITS.title.max + 20}
                />
              )}
            </FormField>
          </div>

          <div className="ledger-panel p-6">
            <FormField
              id="description"
              label="Context"
              required
              hint="What is being decided, and why now. Voters read this before choosing."
              error={errors.description?.message}
              counter={{ value: description?.length ?? 0, max: ELECTION_LIMITS.description.max }}
            >
              {(a11y) => (
                <Textarea
                  {...register("description")}
                  {...a11y}
                  rows={4}
                  placeholder="Should the neighbourhood spend this year's surplus on the garden irrigation project?"
                  maxLength={ELECTION_LIMITS.description.max + 50}
                />
              )}
            </FormField>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="ledger-panel p-6">
              <FormField
                id="option1"
                label="Option A"
                required
                error={errors.option1?.message}
                counter={{ value: option1?.length ?? 0, max: ELECTION_LIMITS.option.max }}
              >
                {(a11y) => <Input {...register("option1")} {...a11y} placeholder="Approve the project" />}
              </FormField>
            </div>
            <div className="ledger-panel p-6">
              <FormField
                id="option2"
                label="Option B"
                required
                error={errors.option2?.message}
                counter={{ value: option2?.length ?? 0, max: ELECTION_LIMITS.option.max }}
              >
                {(a11y) => <Input {...register("option2")} {...a11y} placeholder="Carry the surplus over" />}
              </FormField>
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="ledger-panel p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-on-primary">
                <CalendarDays className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="font-headline text-xl font-bold text-primary">Closing</h3>
            </div>
            <FormField
              id="endDate"
              label="Closing date and time"
              required
              hint={`Times are in your local timezone, ${describeLocalTimezone()}. Voting and nullification stop at this moment.`}
              error={errors.endDate?.message}
              className="mt-5"
            >
              {(a11y) => (
                <Input
                  type="datetime-local"
                  {...register("endDate", { valueAsDate: true })}
                  {...a11y}
                  min={minDeadline}
                  defaultValue={toDateTimeLocalValue(defaultDeadline())}
                />
              )}
            </FormField>
          </div>

          <div className="ledger-panel p-6">
            <label htmlFor="showRunningTally" className="flex cursor-pointer items-start gap-3">
              <input
                id="showRunningTally"
                type="checkbox"
                {...register("showRunningTally")}
                className="mt-1 h-5 w-5 shrink-0 rounded border-outline-variant text-secondary focus:ring-secondary"
              />
              <span>
                <span className="block font-semibold text-primary">Show running results while voting</span>
                <span id="showRunningTally-hint" className="mt-1 block text-xs leading-relaxed text-on-surface-variant">
                  {showRunningTally
                    ? "Voters see the current count before they choose. Turn this off to keep counts hidden until the election closes."
                    : "Counts stay hidden on the ballot and in the elections list until the election closes. Ballots themselves remain public."}
                </span>
              </span>
            </label>
          </div>
        </aside>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-outline-variant pt-6">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" busy={isSubmitting}>
          {isSubmitting ? "Publishing…" : "Publish Election"}
        </Button>
      </div>
    </form>
  );
};

export default ElectionForm;
