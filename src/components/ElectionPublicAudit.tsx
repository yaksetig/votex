import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Database as DatabaseIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type AuditTab = "ballots" | "participants" | "activity";
type PublicVote = Database["public"]["Views"]["public_votes"]["Row"];
type PublicParticipant = Database["public"]["Views"]["public_participants"]["Row"];

interface ActivityRow {
  id: string;
  occurredAt: string | null;
  pseudonym: string | null;
  action: string;
  record: string;
}

const TABS: Array<{ id: AuditTab; label: string }> = [
  { id: "ballots", label: "Public Ballots" },
  { id: "participants", label: "Participants" },
  { id: "activity", label: "Audit Trail" },
];

function shortened(value: string | null | undefined, length = 16) {
  if (!value) return "—";
  if (value.length <= length) return value;
  return `${value.slice(0, Math.ceil(length / 2))}…${value.slice(-Math.floor(length / 2))}`;
}

function displayedTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default function ElectionPublicAudit({ electionId }: { electionId: string }) {
  const [tab, setTab] = useState<AuditTab>("ballots");
  const [limit, setLimit] = useState(25);
  const [votes, setVotes] = useState<PublicVote[]>([]);
  const [participants, setParticipants] = useState<PublicParticipant[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setLimit(25), [tab]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const load = async () => {
      if (tab === "ballots") {
        const { data, error: queryError } = await supabase
          .from("public_votes")
          .select("*")
          .eq("election_id", electionId)
          .order("accepted_at", { ascending: false })
          .range(0, limit - 1);
        if (queryError) throw queryError;
        if (!cancelled) setVotes(data ?? []);
        return;
      }

      if (tab === "participants") {
        const { data, error: queryError } = await supabase
          .from("public_participants")
          .select("*")
          .eq("election_id", electionId)
          .order("joined_at", { ascending: false })
          .range(0, limit - 1);
        if (queryError) throw queryError;
        if (!cancelled) setParticipants(data ?? []);
        return;
      }

      const { data, error: queryError } = await supabase
        .from("public_election_activity")
        .select("*")
        .eq("election_id", electionId)
        .order("occurred_at", { ascending: false })
        .order("id", { ascending: false })
        .range(0, limit - 1);
      if (queryError) throw queryError;

      const rows: ActivityRow[] = (data ?? []).map((row) => ({
        id: row.id ?? `${row.action}-${row.occurred_at}`,
        occurredAt: row.occurred_at,
        pseudonym: row.pseudonym,
        action: row.action ?? "Election activity",
        record: shortened(row.record),
      }));

      if (!cancelled) setActivity(rows);
    };

    void load()
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Public audit data could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [electionId, limit, tab]);

  const visibleCount = tab === "ballots" ? votes.length : tab === "participants" ? participants.length : activity.length;

  return (
    <section className="border-t border-outline-variant pt-8" aria-labelledby="public-audit-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="civic-label text-secondary">Public verification</p>
          <h2 id="public-audit-title" className="mt-2 font-headline text-2xl font-semibold text-primary">Election audit ledger</h2>
          <p className="mt-2 text-sm text-on-surface-variant">Sanitized public records used to independently inspect election activity.</p>
        </div>
        <Link to="/audit-protocol" className="text-sm font-bold text-secondary hover:text-primary">How to audit these records</Link>
      </div>

      <div className="mt-6 flex gap-6 overflow-x-auto border-b border-outline-variant" role="tablist" aria-label="Public audit datasets">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "whitespace-nowrap border-b-2 px-1 pb-3 text-xs font-bold uppercase tracking-[0.05em]",
              tab === id ? "border-secondary text-secondary" : "border-transparent text-on-surface-variant hover:text-secondary"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low">
        {loading ? (
          <div className="flex min-h-40 items-center justify-center gap-3 text-sm text-on-surface-variant" role="status">
            <Loader2 className="h-5 w-5 animate-spin text-secondary" aria-hidden="true" /> Loading public records…
          </div>
        ) : error ? (
          <div className="p-6 text-sm text-on-error-container" role="alert">{error}</div>
        ) : visibleCount === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center p-6 text-center">
            <DatabaseIcon className="h-8 w-8 text-outline" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-primary">No records published in this dataset yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-outline-variant bg-surface text-xs font-semibold text-on-surface-variant">
                {tab === "ballots" ? (
                  <tr><th className="p-4">Accepted</th><th className="p-4">Pseudonym</th><th className="p-4">Choice</th><th className="p-4">Receipt</th></tr>
                ) : tab === "participants" ? (
                  <tr><th className="p-4">Joined</th><th className="p-4">Pseudonym</th><th className="p-4">Public key</th></tr>
                ) : (
                  <tr><th className="p-4">Time</th><th className="p-4">Action</th><th className="p-4">Pseudonym</th><th className="p-4">Record</th></tr>
                )}
              </thead>
              <tbody className="divide-y divide-outline-variant/40 bg-surface-container-lowest">
                {tab === "ballots" && votes.map((vote) => (
                  <tr key={vote.receipt_id ?? `${vote.voter_pseudonym}-${vote.signed_at}`}>
                    <td className="whitespace-nowrap p-4 text-on-surface-variant">{displayedTime(vote.accepted_at)}</td>
                    <td className="civic-mono p-4 text-primary">{shortened(vote.voter_pseudonym)}</td>
                    <td className="p-4 font-semibold text-secondary">{vote.choice}</td>
                    <td className="civic-mono p-4">{vote.receipt_id ? <Link to={`/receipts/${vote.receipt_id}`} className="text-secondary hover:underline">{shortened(vote.receipt_id)}</Link> : "—"}</td>
                  </tr>
                ))}
                {tab === "participants" && participants.map((participant) => (
                  <tr key={participant.id ?? participant.voter_pseudonym}>
                    <td className="whitespace-nowrap p-4 text-on-surface-variant">{displayedTime(participant.joined_at)}</td>
                    <td className="civic-mono p-4 text-primary">{shortened(participant.voter_pseudonym)}</td>
                    <td className="civic-mono p-4 text-on-surface-variant">{shortened(participant.public_key_x, 20)}</td>
                  </tr>
                ))}
                {tab === "activity" && activity.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap p-4 text-on-surface-variant">{displayedTime(row.occurredAt)}</td>
                    <td className="p-4 font-semibold text-primary">{row.action}</td>
                    <td className="civic-mono p-4">{shortened(row.pseudonym)}</td>
                    <td className="civic-mono p-4 text-on-surface-variant">{row.record}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && !error && visibleCount >= limit && (
          <div className="border-t border-outline-variant bg-surface p-3 text-center">
            <button type="button" onClick={() => setLimit((current) => current + 25)} className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.05em] text-secondary hover:underline">
              Load 25 More <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
