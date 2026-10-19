import React, { useMemo } from "react";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { useAuthorityElections } from "@/hooks/queries/useAuthorityElections";
import { pluralize } from "@/lib/format";
import { getElectionLifecycle } from "@/lib/electionLifecycle";
import { getElectionStatus } from "@/lib/electionStatus";
import { StatusPill } from "@/components/StatusPill";
import { Skeleton } from "@/components/Skeleton";
import { Time } from "@/components/Time";
import { Button } from "@/components/ui/button";

interface AuthorityElectionsListProps {
  authorityId: string;
  authorityName: string;
  onElectionSelect: (electionId: string) => void;
}

const AuthorityElectionsList: React.FC<AuthorityElectionsListProps> = ({ authorityId, authorityName, onElectionSelect }) => {
  const { data: elections = [], isLoading, isError, refetch, isFetching } = useAuthorityElections(authorityId);

  const stats = useMemo(
    () =>
      elections.reduce(
        (acc, election) => {
          const open = getElectionStatus(election) === "active";
          acc.open += open ? 1 : 0;
          acc.awaitingTally += !open && !election.tally_processed ? 1 : 0;
          acc.tallied += election.tally_processed ? 1 : 0;
          return acc;
        },
        { open: 0, awaitingTally: 0, tallied: 0 }
      ),
    [elections]
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-36" label="Loading elections" />
        <Skeleton className="h-[34rem]" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="ledger-panel p-8" role="alert">
        <div className="flex items-start gap-4 rounded-xl bg-error-container p-5 text-on-error-container">
          <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-error" aria-hidden="true" />
          <div>
            <h2 className="font-headline text-xl font-bold">Elections could not be loaded</h2>
            <p className="mt-2 text-sm">Check your connection and try again.</p>
            <Button variant="outline" className="mt-4" onClick={() => void refetch()} busy={isFetching}>
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="border-b border-outline-variant pb-8">
        <p className="ledger-eyebrow">{authorityName}</p>
        <h1 className="mt-3 font-headline text-3xl font-bold tracking-[-0.03em] text-primary">Elections</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-on-surface-variant">
          Every election is bound to this authority. Open one to close it early, edit it before the first ballot, or run
          the tally once it has closed.
        </p>
      </header>

      <dl className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Open", value: stats.open },
          { label: "Awaiting tally", value: stats.awaitingTally },
          { label: "Tallied", value: stats.tallied },
        ].map(({ label, value }) => (
          <div key={label} className="ledger-panel p-5">
            <dt className="ledger-eyebrow">{label}</dt>
            <dd className="mt-2 font-headline text-3xl font-bold tabular-nums text-primary">{value}</dd>
          </div>
        ))}
      </dl>

      <section className="ledger-panel overflow-hidden" aria-labelledby="authority-elections-title">
        <div className="flex flex-col gap-2 border-b border-outline-variant p-6 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="authority-elections-title" className="font-headline text-2xl font-bold text-primary">
            All elections
          </h2>
          <p className="text-sm text-on-surface-variant">{pluralize(elections.length, "election")}</p>
        </div>

        {elections.length === 0 ? (
          <div className="p-10 text-center">
            <h3 className="font-headline text-2xl font-bold text-primary">No elections yet</h3>
            <p className="mt-3 text-sm text-on-surface-variant">
              Elections are created by verified voters from the public site; they appear here as soon as one is published.
            </p>
          </div>
        ) : (
          <>
            {/* Narrow screens: one card per election, so the action is never off-screen. */}
            <ul className="divide-y divide-outline-variant md:hidden" aria-label="Elections">
              {elections.map((election) => (
                <li key={election.id} className="space-y-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-on-surface">{election.title}</p>
                    <StatusPill lifecycle={getElectionLifecycle(election, { tallied: election.tally_processed })} />
                  </div>
                  <p className="line-clamp-2 text-xs text-on-surface-variant">{election.description}</p>
                  <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-on-surface-variant">
                    <div>
                      <dt className="inline">Closes </dt>
                      <dd className="inline"><Time value={election.closed_manually_at ?? election.end_date} /></dd>
                    </div>
                    <div>
                      <dt className="inline">Ballots </dt>
                      <dd className="inline font-semibold tabular-nums text-primary">{election.vote_count || 0}</dd>
                    </div>
                  </dl>
                  <Button variant="outline" size="sm" className="w-full" onClick={() => onElectionSelect(election.id)} aria-label={`Open ${election.title}`}>
                    Open <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block" tabIndex={0} role="region" aria-label="Elections table">
              <table className="min-w-full text-left">
                <caption className="sr-only">Elections bound to {authorityName}</caption>
                <thead className="border-b border-outline-variant bg-surface-container-lowest text-xs font-semibold text-on-surface-variant">
                  <tr>
                    <th scope="col" className="px-6 py-4">Election</th>
                    <th scope="col" className="px-6 py-4">Status</th>
                    <th scope="col" className="px-6 py-4">Closes</th>
                    <th scope="col" className="px-6 py-4 text-right">Ballots</th>
                    <th scope="col" className="px-6 py-4 text-right">
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {elections.map((election) => (
                    <tr key={election.id} className="transition-colors hover:bg-surface-container-low">
                      <td className="px-6 py-5">
                        <p className="font-semibold text-on-surface">{election.title}</p>
                        <p className="mt-1 line-clamp-2 max-w-md text-xs text-on-surface-variant">{election.description}</p>
                      </td>
                      <td className="px-6 py-5">
                        <StatusPill lifecycle={getElectionLifecycle(election, { tallied: election.tally_processed })} />
                      </td>
                      <td className="whitespace-nowrap px-6 py-5 text-sm text-on-surface-variant">
                        <Time value={election.closed_manually_at ?? election.end_date} />
                      </td>
                      <td className="px-6 py-5 text-right font-headline text-xl font-extrabold tabular-nums text-primary">
                        {election.vote_count || 0}
                      </td>
                      <td className="px-6 py-5 text-right">
                        <Button variant="outline" size="sm" onClick={() => onElectionSelect(election.id)} aria-label={`Open ${election.title}`}>
                          Open <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default AuthorityElectionsList;
