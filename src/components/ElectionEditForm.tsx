import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarDays, Edit3, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/FormField";
import { useToast } from "@/hooks/use-toast";
import { updateElectionDetails } from "@/services/electionOperationsService";
import {
  DISTINCT_OPTIONS_MESSAGE,
  ELECTION_LIMITS,
  electionFieldSchemas,
  optionsAreDistinct,
} from "@/components/ElectionForm/schema";
import type { Election } from "@/types/election";
import { Time } from "@/components/Time";
import { describeError } from "@/lib/errorMessages";
import { describeLocalTimezone, toDateTimeLocalValue } from "@/lib/format";

const editElectionSchema = z
  .object({
    ...electionFieldSchemas,
    end_date: z
      .string()
      .min(1, "Choose a closing date and time")
      .refine((value) => new Date(value).getTime() > Date.now(), { message: "Choose a closing date in the future" }),
  })
  .refine((values) => optionsAreDistinct(values.option1, values.option2), {
    message: DISTINCT_OPTIONS_MESSAGE,
    path: ["option2"],
  });

type EditElectionFormValues = z.infer<typeof editElectionSchema>;

interface ElectionEditFormProps {
  election: Election;
  onElectionUpdated: () => void;
}

/**
 * Edits an election that has no ballots yet. The dashboard only mounts this
 * form while editing is safe, and the database refuses updates afterwards,
 * so there is no "edit anyway" path here.
 */
const ElectionEditForm: React.FC<ElectionEditFormProps> = ({ election, onElectionUpdated }) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
  } = useForm<EditElectionFormValues>({
    resolver: zodResolver(editElectionSchema),
    defaultValues: {
      title: election.title,
      description: election.description,
      option1: election.option1,
      option2: election.option2,
      // Local time, never UTC: the input shows what the voter sees.
      end_date: toDateTimeLocalValue(election.end_date),
      showRunningTally: election.show_running_tally ?? true,
    },
  });

  const [title, description, option1, option2, showRunningTally] = watch([
    "title",
    "description",
    "option1",
    "option2",
    "showRunningTally",
  ]);

  const onSubmit = async (data: EditElectionFormValues) => {
    if (!isDirty) {
      toast({ key: "election-edit", title: "No changes to save" });
      return;
    }
    try {
      setIsUpdating(true);
      await updateElectionDetails(election.id, {
        title: data.title,
        description: data.description,
        option1: data.option1,
        option2: data.option2,
        end_date: new Date(data.end_date).toISOString(),
        show_running_tally: data.showRunningTally,
      });
      toast({ key: "election-edit", title: "Election updated", description: "The change is recorded in the audit trail." });
      onElectionUpdated();
    } catch (error) {
      toast({
        key: "election-edit",
        variant: "destructive",
        title: "Election not updated",
        description: describeError(error, "The changes could not be saved. Try again."),
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8" aria-labelledby="edit-election-title" noValidate>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="ledger-eyebrow">Edit election</p>
          <h2 id="edit-election-title" className="mt-2 font-headline text-3xl font-bold text-primary">
            Edit the question and the closing time
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
            Editing is possible until the first ballot is cast. Saving records the change in the audit trail.
          </p>
        </div>
        <div className="rounded-xl bg-surface-container-low px-5 py-4">
          <p className="ledger-eyebrow">Currently closes</p>
          <p className="mt-2 font-semibold text-primary">
            <Time value={election.end_date} relative />
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_360px]">
        <div className="space-y-6">
          <div className="ledger-panel p-6">
            <FormField
              id="edit-title"
              label="Election title"
              required
              error={errors.title?.message}
              counter={{ value: title?.length ?? 0, max: ELECTION_LIMITS.title.max }}
            >
              {(a11y) => <Input {...register("title")} {...a11y} disabled={isUpdating} />}
            </FormField>
          </div>

          <div className="ledger-panel p-6">
            <FormField
              id="edit-description"
              label="Context"
              required
              error={errors.description?.message}
              counter={{ value: description?.length ?? 0, max: ELECTION_LIMITS.description.max }}
            >
              {(a11y) => <Textarea {...register("description")} {...a11y} rows={4} disabled={isUpdating} />}
            </FormField>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="ledger-panel p-6">
              <FormField
                id="edit-option1"
                label="Option A"
                required
                error={errors.option1?.message}
                counter={{ value: option1?.length ?? 0, max: ELECTION_LIMITS.option.max }}
              >
                {(a11y) => <Input {...register("option1")} {...a11y} disabled={isUpdating} />}
              </FormField>
            </div>
            <div className="ledger-panel p-6">
              <FormField
                id="edit-option2"
                label="Option B"
                required
                error={errors.option2?.message}
                counter={{ value: option2?.length ?? 0, max: ELECTION_LIMITS.option.max }}
              >
                {(a11y) => <Input {...register("option2")} {...a11y} disabled={isUpdating} />}
              </FormField>
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="ledger-panel p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-white">
                <CalendarDays className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="font-headline text-xl font-bold text-primary">Closing</h3>
            </div>
            <FormField
              id="edit-end_date"
              label="Closing date and time"
              required
              hint={`Times are in your local timezone, ${describeLocalTimezone()}.`}
              error={errors.end_date?.message}
              className="mt-5"
            >
              {(a11y) => (
                <Input
                  type="datetime-local"
                  {...register("end_date")}
                  {...a11y}
                  min={toDateTimeLocalValue(new Date(Date.now() + 60_000))}
                  disabled={isUpdating}
                />
              )}
            </FormField>
          </div>

          <div className="ledger-panel p-6">
            <label htmlFor="edit-showRunningTally" className="flex cursor-pointer items-start gap-3">
              <input
                id="edit-showRunningTally"
                type="checkbox"
                {...register("showRunningTally")}
                disabled={isUpdating}
                className="mt-1 h-5 w-5 shrink-0 rounded border-outline-variant text-secondary focus:ring-secondary"
              />
              <span>
                <span className="block font-semibold text-primary">Show running results while voting</span>
                <span className="mt-1 block text-xs leading-relaxed text-on-surface-variant">
                  {showRunningTally
                    ? "Voters see the current count before they choose."
                    : "Counts stay hidden until the election closes. Ballots themselves remain public."}
                </span>
              </span>
            </label>
          </div>
        </aside>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-outline-variant pt-6">
        <p className="inline-flex items-center gap-3 text-sm text-on-surface-variant" role="status">
          <Edit3 className="h-4 w-4 text-surface-tint" aria-hidden="true" />
          {isDirty ? "Saving records this change in the audit trail." : "No changes yet."}
        </p>
        <Button type="submit" busy={isUpdating} aria-disabled={!isDirty || undefined}>
          {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
          {isUpdating ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
};

export default ElectionEditForm;
