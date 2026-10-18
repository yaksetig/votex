import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Time } from "@/components/Time";
import { howItWorksSection } from "@/lib/routes";

interface NullificationPanelProps {
  electionEndDate: string;
  /** When this voter last submitted a request in this tab; shown neutrally. */
  lastSubmittedAt: string | null;
  /** Measured duration of the previous run on this device, in seconds. */
  expectedSeconds: number | null;
  busy: boolean;
  onOpen: () => void;
}

/**
 * The panel a voter sees after casting. It says what a nullification request
 * is, why decoys matter, that nullifying is final, how long the request
 * takes, and what to do under pressure. One neutral button opens the dialog
 * where the real/decoy choice is made.
 */
export function NullificationPanel({ electionEndDate, lastSubmittedAt, expectedSeconds, busy, onOpen }: NullificationPanelProps) {
  const duration = expectedSeconds
    ? `About ${expectedSeconds} ${expectedSeconds === 1 ? "second" : "seconds"} on this device`
    : "Up to a minute";

  return (
    <section className="ledger-panel p-5 sm:p-6 md:p-8" aria-labelledby="nullification-heading">
      <div className="flex flex-col gap-2">
        <h2 id="nullification-heading" className="font-headline text-xl font-bold text-primary sm:text-2xl">
          Nullification
        </h2>
        <div className="h-1 w-12 rounded-full bg-surface-tint" aria-hidden="true" />
      </div>

      <div className="mt-5 space-y-4 text-sm leading-relaxed text-on-surface-variant sm:text-base">
        <p>
          You can cancel your ballot with a <strong className="text-primary">nullification request</strong> until the
          election closes on <Time value={electionEndDate} />. A request is either real, which removes your ballot at the
          tally, or a decoy, which changes nothing. Both look identical to everyone, including Votex.
        </p>
        <p>
          <strong className="text-primary">Decoys matter.</strong> They are what hide real nullifications, so sending one
          after you vote protects voters who need the real thing. Send as many requests as you like.
        </p>
        <p>
          <strong className="text-primary">Nullifying is final.</strong> After a real nullification you cannot cast a new
          ballot in this election.
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-4 rounded-xl border border-outline-variant bg-surface-container-low p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-primary">Takes: {duration}</p>
          <p className="mt-1 text-xs text-on-surface-variant">
            Keeps this tab busy while it builds the encrypted request. You can cancel until it is sent.
          </p>
        </div>
        <Button type="button" onClick={onOpen} busy={busy} size="lg" className="shrink-0">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Submit nullification request
        </Button>
      </div>

      {lastSubmittedAt && (
        <div className="mt-4 rounded-lg bg-primary-fixed p-4 text-sm leading-relaxed text-primary" role="status">
          <p className="font-semibold">
            Request submitted at <Time value={lastSubmittedAt} />.
          </p>
          <p className="mt-1">
            This page does not change after a request, by design: nobody can tell from it whether you nullified or sent a
            decoy. You may submit more requests until the election closes.
          </p>
        </div>
      )}

      <p className="mt-6 text-sm text-on-surface-variant">
        Were you pressured to vote a certain way?{" "}
        <Link to={howItWorksSection("pressure")} className="font-semibold text-secondary underline-offset-4 hover:underline">
          What to do
        </Link>
      </p>
    </section>
  );
}
