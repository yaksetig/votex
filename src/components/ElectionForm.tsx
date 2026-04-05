import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { initializeDefaultElectionAuthority, getElectionAuthorities } from "@/services/electionAuthorityService";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formSchema, FormData, ElectionFormProps } from "@/components/ElectionForm/types";

const ElectionForm: React.FC<ElectionFormProps> = ({ onSubmit, onCancel }) => {
  const { toast } = useToast();
  const [defaultAuthorityId, setDefaultAuthorityId] = useState<string>("");

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      option1: "Yes",
      option2: "No",
    },
  });

  useEffect(() => {
    const initializeDefaultAuthority = async () => {
      try {
        await initializeDefaultElectionAuthority();
        const authorities = await getElectionAuthorities();
        const defaultAuthority = authorities.find(
          (authority) => authority.name === "Default Election Authority"
        );

        if (defaultAuthority) {
          setDefaultAuthorityId(defaultAuthority.id);
          setValue("authorityId", defaultAuthority.id);
        }
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Authority unavailable",
          description: "The default election authority could not be loaded.",
        });
      }
    };

    void initializeDefaultAuthority();
  }, [setValue, toast]);

  const onSubmitForm = async (data: FormData) => {
    try {
      await onSubmit({
        ...data,
        authorityId: defaultAuthorityId,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Publish failed",
        description: "The election draft could not be published.",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <span className="ledger-badge bg-secondary-container text-on-secondary-container">
            <Sparkles className="h-4 w-4" />
            Ledger composer
          </span>
          <h2 className="mt-4 font-headline text-3xl font-extrabold text-primary">Create a new binary election</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-on-surface-variant">
            Publish a consensus question with two mutually exclusive outcomes. The election will be bound to the default authority until the secure authority assignment flow is expanded.
          </p>
        </div>
        <div className="rounded-[1.5rem] bg-surface-container-low px-5 py-4">
          <p className="ledger-eyebrow">Authority binding</p>
          <p className="mt-2 text-sm font-semibold text-primary">Default Election Authority</p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_360px]">
        <div className="space-y-6">
          <div className="rounded-[1.75rem] border border-outline-variant/12 bg-surface-container-lowest p-6">
            <Label htmlFor="title" className="ledger-eyebrow">
              Election title
            </Label>
            <Input id="title" {...register("title")} className="mt-3" placeholder="2024 Municipal Digital Infrastructure Bond" />
            {errors.title && <p className="mt-2 text-sm text-error">{errors.title.message}</p>}
          </div>

          <div className="rounded-[1.75rem] border border-outline-variant/12 bg-surface-container-lowest p-6">
            <Label htmlFor="description" className="ledger-eyebrow">
              Context
            </Label>
            <Textarea
              id="description"
              {...register("description")}
              className="mt-3"
              placeholder="Explain the proposal, its scope, and why the electorate is being asked to decide."
            />
            {errors.description && <p className="mt-2 text-sm text-error">{errors.description.message}</p>}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-[1.75rem] border border-outline-variant/12 bg-surface-container-lowest p-6">
              <Label htmlFor="option1" className="ledger-eyebrow">
                Option A
              </Label>
              <Input id="option1" {...register("option1")} className="mt-3" placeholder="Approve Bond" />
              {errors.option1 && <p className="mt-2 text-sm text-error">{errors.option1.message}</p>}
            </div>

            <div className="rounded-[1.75rem] border border-outline-variant/12 bg-surface-container-lowest p-6">
              <Label htmlFor="option2" className="ledger-eyebrow">
                Option B
              </Label>
              <Input id="option2" {...register("option2")} className="mt-3" placeholder="Decline Bond" />
              {errors.option2 && <p className="mt-2 text-sm text-error">{errors.option2.message}</p>}
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-[1.75rem] border border-outline-variant/12 bg-surface-container-lowest p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-on-primary">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <p className="ledger-eyebrow">Election closes</p>
                <h3 className="mt-1 font-headline text-xl font-bold text-primary">Set the deadline</h3>
              </div>
            </div>

            <Input id="endDate" type="datetime-local" {...register("endDate", { valueAsDate: true })} className="mt-5" />
            {errors.endDate && <p className="mt-2 text-sm text-error">{errors.endDate.message}</p>}
          </div>

          <div className="rounded-[1.75rem] bg-primary-container p-6 text-on-primary">
            <p className="ledger-eyebrow text-on-primary-container">Publishing notes</p>
            <p className="mt-3 text-sm leading-relaxed text-white/74">
              Once live, votes begin forming the Votex ledger trail for this election. Keep labels short and precise to preserve signature clarity and audit readability.
            </p>
          </div>
        </aside>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-outline-variant/15 pt-6">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="bg-gradient-to-br from-primary to-primary-container text-on-primary" disabled={isSubmitting}>
          {isSubmitting ? "Publishing..." : "Publish Election"}
        </Button>
      </div>
    </form>
  );
};

export default ElectionForm;
