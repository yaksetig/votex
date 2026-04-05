import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertTriangle,
  CalendarDays,
  Edit3,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { updateElectionDetails } from "@/services/electionManagementService";

const editElectionSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title too long"),
  description: z
    .string()
    .min(1, "Description is required")
    .max(500, "Description too long"),
  option1: z.string().min(1, "Option 1 is required").max(50, "Option 1 too long"),
  option2: z.string().min(1, "Option 2 is required").max(50, "Option 2 too long"),
  end_date: z.string().min(1, "End date is required"),
});

type EditElectionFormValues = z.infer<typeof editElectionSchema>;

interface ElectionEditFormProps {
  election: any;
  safeToEdit: boolean;
  onElectionUpdated: () => void;
}

const ElectionEditForm: React.FC<ElectionEditFormProps> = ({
  election,
  onElectionUpdated,
  safeToEdit,
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<EditElectionFormValues>({
    resolver: zodResolver(editElectionSchema),
    defaultValues: {
      title: election.title,
      description: election.description,
      option1: election.option1,
      option2: election.option2,
      end_date: new Date(election.end_date).toISOString().slice(0, 16),
    },
  });

  const onSubmit = async (data: EditElectionFormValues) => {
    if (!isDirty) {
      toast({
        title: "No changes detected",
        description: "Update one or more fields before saving.",
      });
      return;
    }

    if (!safeToEdit) {
      const confirmed = window.confirm(
        "This election already has votes. Updating labels or dates may affect audit expectations. Continue?"
      );

      if (!confirmed) {
        return;
      }
    }

    try {
      setIsUpdating(true);

      const success = await updateElectionDetails(election.id, {
        description: data.description,
        end_date: new Date(data.end_date).toISOString(),
        option1: data.option1,
        option2: data.option2,
        title: data.title,
      });

      if (!success) {
        throw new Error("Failed to update election");
      }

      toast({
        title: "Election updated",
        description: "The revised election details have been saved.",
      });
      onElectionUpdated();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="ledger-eyebrow">Election editor</p>
          <h2 className="mt-2 font-headline text-3xl font-extrabold text-primary">
            Refine ballot language and timeline
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
            Use this form to update the active election metadata. Changes are recorded in the audit trail and should preserve the meaning of already published commitments.
          </p>
        </div>

        <div className="rounded-[1.5rem] bg-surface-container-low px-5 py-4">
          <p className="ledger-eyebrow">Current end date</p>
          <p className="mt-2 font-semibold text-primary">
            {new Date(election.end_date).toLocaleString()}
          </p>
        </div>
      </div>

      {!safeToEdit && (
        <div className="rounded-[1.5rem] border border-error/20 bg-error-container/70 p-5 text-on-error-container">
          <div className="flex items-start gap-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-error" />
            <div>
              <h3 className="font-headline text-xl font-bold text-primary">
                Editing after votes have been cast is risky
              </h3>
              <p className="mt-2 text-sm leading-relaxed">
                Option labels are locked for good reason. If you proceed, keep the semantics stable so historical signatures and public expectations remain coherent.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_360px]">
        <div className="space-y-6">
          <div className="rounded-[1.75rem] border border-outline-variant/12 bg-surface-container-lowest p-6">
            <Label htmlFor="title" className="ledger-eyebrow">
              Election title
            </Label>
            <Input id="title" {...register("title")} className="mt-3" disabled={isUpdating} />
            {errors.title && (
              <p className="mt-2 text-sm text-error">{errors.title.message}</p>
            )}
          </div>

          <div className="rounded-[1.75rem] border border-outline-variant/12 bg-surface-container-lowest p-6">
            <Label htmlFor="description" className="ledger-eyebrow">
              Description
            </Label>
            <Textarea
              id="description"
              {...register("description")}
              className="mt-3"
              disabled={isUpdating}
            />
            {errors.description && (
              <p className="mt-2 text-sm text-error">{errors.description.message}</p>
            )}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-[1.75rem] border border-outline-variant/12 bg-surface-container-lowest p-6">
              <Label htmlFor="option1" className="ledger-eyebrow">
                Option A
              </Label>
              <Input
                id="option1"
                {...register("option1")}
                className="mt-3"
                disabled={isUpdating || !safeToEdit}
              />
              {errors.option1 && (
                <p className="mt-2 text-sm text-error">{errors.option1.message}</p>
              )}
            </div>

            <div className="rounded-[1.75rem] border border-outline-variant/12 bg-surface-container-lowest p-6">
              <Label htmlFor="option2" className="ledger-eyebrow">
                Option B
              </Label>
              <Input
                id="option2"
                {...register("option2")}
                className="mt-3"
                disabled={isUpdating || !safeToEdit}
              />
              {errors.option2 && (
                <p className="mt-2 text-sm text-error">{errors.option2.message}</p>
              )}
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-[1.75rem] border border-outline-variant/12 bg-surface-container-lowest p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <p className="ledger-eyebrow">Voting deadline</p>
                <h3 className="mt-1 font-headline text-2xl font-bold text-primary">
                  Adjust closing time
                </h3>
              </div>
            </div>

            <Input
              id="end_date"
              type="datetime-local"
              {...register("end_date")}
              className="mt-5"
              disabled={isUpdating}
            />
            {errors.end_date && (
              <p className="mt-2 text-sm text-error">{errors.end_date.message}</p>
            )}
          </div>

          <div className="rounded-[1.75rem] bg-primary-container p-6 text-on-primary">
            <p className="ledger-eyebrow text-on-primary-container">Editing rules</p>
            <div className="mt-4 space-y-3 text-sm text-white/74">
              <p>Keep option labels precise and stable.</p>
              <p>Do not rewrite the question after votes exist unless the policy owner explicitly approves.</p>
              <p>Every save becomes part of the authority audit trail.</p>
            </div>
          </div>
        </aside>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-outline-variant/15 pt-6">
        <div className="inline-flex items-center gap-3 text-sm text-on-surface-variant">
          <Edit3 className="h-4 w-4 text-surface-tint" />
          {isDirty
            ? "Unsaved changes will be recorded in the audit trail."
            : "No pending changes."}
        </div>

        <Button type="submit" disabled={isUpdating || !isDirty}>
          {isUpdating ? (
            <>
              <Save className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </form>
  );
};

export default ElectionEditForm;
