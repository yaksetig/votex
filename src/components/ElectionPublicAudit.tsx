import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Copy, Database as DatabaseIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { abbreviateIdentifier, formatDateTime } from "@/lib/format";
import { ROUTES } from "@/lib/routes";

type AuditTab = "ballots" | "participants" | "delegations" | "nullifications" | "activity";
type PublicVote = Database["public"]["Views"]["public_votes"]["Row"];
type PublicParticipant = Database["public"]["Views"]["public_participants"]["Row"];
type PublicDelegation = Database["public"]["Views"]["public_delegations"]["Row"];
type PublicNullification = Database["public"]["Views"]["public_nullifications"]["Row"];

interface ActivityRow {
  id: string;
  occurredAt: string | null;
  pseudonym: string | null;
  action: string;
  record: string | null;
}

const PAGE = 25;

const TABS: Array<{ id: AuditTab; label: string; legend: string }> = [
  { id: "ballots", label: "Public Ballots", legend: "Every accepted ballot: who (by pseudonym), what they chose, and the receipt that proves it." },
  { id: "participants", label: "Participants", legend: "Pseudonyms that registered a voting key for this election, with the public half of that key." },
  { id: "delegations", label: "Delegations", legend: "Who delegated and when. The delegate is encrypted to the Election Authority and is not public." },
  { id: "nullifications", label: "Nullification proofs", legend: "Encrypted nullification requests. Real requests and decoys are indistinguishable here by design." },
  { id: "activity", label: "Audit Trail", legend: "Everything that changed this election, in order, including Election Authority actions." },
];

/** Raw action identifiers from the activity view in plain words; the raw code stays visible for auditors. */
const ACTION_LABELS: Record<string, string> = {
  CLOSE_ELECTION: "Election closed early by the Election Authority",
  UPDATE_ELECTION: "Election details edited",
  AUTHENTICATION: "Election Authority signed in",
  "Delegation submitted": "Ballot delegated",
  "Delegation revoked": "Delegation revoked",
  "Nullification proof accepted": "Nullification request accepted",
  "Tally record published": "Tally published",
};

function Identifier({ value, viewer }: { value: string | null | undefined; viewer?: string | null }) {
  const { toast } = useToast();
  if (!value) return <span>—</span>;
  const mine = Boolean(viewer) && value === viewer;
  return (
    <span className="inline-flex max-w-full items-center gap-1">
      <code className={cn("civic-mono truncate", mine ? "font-bold text-secondary" : "text-primary")} title={value}>
        {abbreviateIdentifier(value, 8)}
      </code>
      {mine && <span className="rounded-full bg-secondary-container px-2 py-0.5 text-xs font-semibold text-on-secondary-container">You</span>}
      <button
        type="button"
        aria-label={`Copy ${abbreviateIdentifier(value, 4)}`}
        onClick={() => {
          void navigator.clipboard
            .writeText(value)
            .then(() => toast({ key: "clipboard", title: "Copied" }))
            .catch(() => toast({ key: "clipboard", variant: "destructive", title: "Copy failed" }));
        }}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-on-surface-variant hover:bg-surface-container hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
      >
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </span>
  );
}

function displayedTime(value: string | null | undefined) {
  if (!value) return "—";
  return formatDateTime(value);
}

interface ElectionPublicAuditProps {
  electionId: string;
  /** The signed-in voter's pseudonym; their own rows are highlighted. */
  viewerPseudonym?: string | null;
}

export default function ElectionPublicAudit({ electionId, viewerPseudonym }: ElectionPublicAuditProps) {
  const [tab, setTab] = useState<AuditTab>("ballots");
  const [limit, setLimit] = useState(PAGE);
  const [votes, setVotes] = useState<PublicVote[]>([]);
  const [participants, setParticipants] = useState<PublicParticipant[]>([]);
  const [delegations, setDelegations] = useState<PublicDelegation[]>([]);
  const [nullifications, setNullifications] = useState<PublicNullification[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => setLimit(PAGE), [tab]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);

    const load = async () => {
      const range = [0, limit - 1] as const;
      if (tab === "ballots") {
        const { data, error: queryError } = await supabase.from("public_votes").select("*").eq("election_id", electionId).order("accepted_at", { ascending: false }).range(...range);
        if (queryError) throw queryError;
        if (!cancelled) setVotes(data ?? []);
        return;
      }
      if (tab === "participants") {
        const { data, error: queryError } = await supabase.from("public_participants").select("*").eq("election_id", electionId).order("joined_at", { ascending: false }).range(...range);
        if (queryError) throw queryError;
        if (!cancelled) setParticipants(data ?? []);
        return;
      }
      if (tab === "delegations") {
        const { data, error: queryError } = await supabase.from("public_delegations").select("*").eq("election_id", electionId).order("created_at", { ascending: false }).range(...range);
        if (queryError) throw queryError;
        if (!cancelled) setDelegations(data ?? []);
        return;
      }
      if (tab === "nullifications") {
        const { data, error: queryError } = await supabase.from("public_nullifications").select("*").eq("election_id", electionId).order("created_at", { ascending: false }).range(...range);
        if (queryError) throw queryError;
        if (!cancelled) setNullifications(data ?? []);
        return;
      }
      const { data, error: queryError } = await supabase
        .from("public_election_activity")
        .select("*")
        .eq("election_id", electionId)
        .order("occurred_at", { ascending: false })
        .order("id", { ascending: false })
        .range(...range);
      if (queryError) throw queryError;
      if (!cancelled) {
        setActivity(
          (data ?? []).map((row) => ({
            id: row.id ?? `${row.action}-${row.occurred_at}`,
            occurredAt: row.occurred_at,
            pseudonym: row.pseudonym,
            action: row.action ?? "Election activity",
            record: row.record,
          }))
        );
      }
    };

    void load()
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [electionId, limit, tab, reloadKey]);

  const counts: Record<AuditTab, number> = {
    ballots: votes.length,
    participants: participants.length,
    delegations: delegations.length,
    nullifications: nullifications.length,
    activity: activity.length,
  };
  const visibleCount = counts[tab];
  const current = TABS.find((entry) => entry.id === tab)!;

  const headers: Record<AuditTab, string[]> = {
    ballots: ["Accepted", "Pseudonym", "Choice", "Receipt"],
    participants: ["Joined", "Pseudonym", "Public key"],
    delegations: ["Created", "Delegator", "Status", "Revoked"],
    nullifications: ["Submitted", "Slot pseudonym", "Proof"],
    activity: ["Time", "Action", "Pseudonym", "Record"],
  };

  return (
    <section className="border-t border-outline-variant pt-8" aria-labelledby="public-audit-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="ledger-eyebrow text-secondary">Public records</p>
          <h2 id="public-audit-title" className="mt-2 font-headline text-2xl font-semibold text-primary">
            Public records of this election
          </h2>
          <p className="mt-2 text-sm text-on-surface-variant">Everything anyone can use to check this election independently.</p>
        </div>
        <Link to={ROUTES.auditProtocol} className="inline-flex min-h-11 items-center text-sm font-bold text-secondary hover:text-primary">
          How to audit these records
        </Link>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as AuditTab)} className="mt-6">
        <TabsList aria-label="Public record sets" className="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b border-outline-variant bg-transparent p-0">
          {TABS.map(({ id, label }) => (
            <TabsTrigger
              key={id}
              value={id}
              className="min-h-11 rounded-none border-b-2 border-transparent px-3 text-sm font-semibold text-on-surface-variant data-[state=active]:border-secondary data-[state=active]:bg-transparent data-[state=active]:text-secondary data-[state=active]:shadow-none"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map(({ id, legend }) => (
          <TabsContent key={id} value={id} className="mt-0">
            <p className="mt-4 text-sm text-on-surface-variant">{legend}</p>
          </TabsContent>
        ))}
      </Tabs>

      <div className="mt-4 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low" aria-busy={loading || undefined}>
        {loading && visibleCount === 0 ? (
          <div className="flex min-h-40 items-center justify-center gap-3 text-sm text-on-surface-variant" role="status">
            <Loader2 className="h-5 w-5 animate-spin text-secondary" aria-hidden="true" /> Loading public records…
          </div>
        ) : error ? (
          <div className="p-6 text-sm text-on-error-container" role="alert">
            <p>These records could not be loaded.</p>
            <button type="button" className="ledger-button-secondary mt-3" onClick={() => setReloadKey((k) => k + 1)}>
              Retry
            </button>
          </div>
        ) : visibleCount === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center p-6 text-center">
            <DatabaseIcon className="h-8 w-8 text-on-surface-variant" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-primary">Nothing recorded here yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={`${current.label} table`}>
            <table className="min-w-full text-left text-sm">
              <caption className="sr-only">{current.label} for this election</caption>
              <thead className="border-b border-outline-variant bg-surface text-xs font-semibold text-on-surface-variant">
                <tr>
                  {headers[tab].map((header) => (
                    <th key={header} scope="col" className="p-4">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant bg-surface-container-lowest">
                {tab === "ballots" &&
                  votes.map((vote) => (
                    <tr key={vote.receipt_id ?? `${vote.voter_pseudonym}-${vote.signed_at}`} className={cn(vote.voter_pseudonym === viewerPseudonym && "bg-primary-fixed/40")}>
                      <td className="whitespace-nowrap p-4 text-on-surface-variant">{displayedTime(vote.accepted_at)}</td>
                      <td className="p-4"><Identifier value={vote.voter_pseudonym} viewer={viewerPseudonym} /></td>
                      <td className="p-4 font-semibold text-secondary">{vote.choice}</td>
                      <td className="civic-mono p-4">
                        {vote.receipt_id ? (
                          <Link to={ROUTES.receipt(vote.receipt_id)} className="text-secondary hover:underline" title={vote.receipt_id}>
                            {abbreviateIdentifier(vote.receipt_id, 6)}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                {tab === "participants" &&
                  participants.map((participant) => (
                    <tr key={participant.id ?? participant.voter_pseudonym} className={cn(participant.voter_pseudonym === viewerPseudonym && "bg-primary-fixed/40")}>
                      <td className="whitespace-nowrap p-4 text-on-surface-variant">{displayedTime(participant.joined_at)}</td>
                      <td className="p-4"><Identifier value={participant.voter_pseudonym} viewer={viewerPseudonym} /></td>
                      <td className="p-4"><Identifier value={participant.public_key_x && participant.public_key_y ? `${participant.public_key_x},${participant.public_key_y}` : null} /></td>
                    </tr>
                  ))}
                {tab === "delegations" &&
                  delegations.map((delegation) => (
                    <tr key={delegation.id ?? `${delegation.delegator_pseudonym}-${delegation.created_at}`} className={cn(delegation.delegator_pseudonym === viewerPseudonym && "bg-primary-fixed/40")}>
                      <td className="whitespace-nowrap p-4 text-on-surface-variant">{displayedTime(delegation.created_at)}</td>
                      <td className="p-4"><Identifier value={delegation.delegator_pseudonym} viewer={viewerPseudonym} /></td>
                      <td className="p-4 font-semibold text-primary">{delegation.status === "active" ? "Active" : "Revoked"}</td>
                      <td className="whitespace-nowrap p-4 text-on-surface-variant">{displayedTime(delegation.revoked_at)}</td>
                    </tr>
                  ))}
                {tab === "nullifications" &&
                  nullifications.map((row) => (
                    <tr key={row.id ?? `${row.target_pseudonym}-${row.created_at}`} className={cn(row.target_pseudonym === viewerPseudonym && "bg-primary-fixed/40")}>
                      <td className="whitespace-nowrap p-4 text-on-surface-variant">{displayedTime(row.created_at)}</td>
                      <td className="p-4"><Identifier value={row.target_pseudonym} viewer={viewerPseudonym} /></td>
                      <td className="p-4 text-on-surface-variant">{row.nullifier_zkp ? "Zero-knowledge proof verified by the server" : "—"}</td>
                    </tr>
                  ))}
                {tab === "activity" &&
                  activity.map((row) => (
                    <tr key={row.id}>
                      <td className="whitespace-nowrap p-4 text-on-surface-variant">{displayedTime(row.occurredAt)}</td>
                      <td className="p-4">
                        <span className="font-semibold text-primary">{ACTION_LABELS[row.action] ?? row.action}</span>
                        {ACTION_LABELS[row.action] && ACTION_LABELS[row.action] !== row.action && (
                          <code className="civic-mono ml-2 text-xs text-on-surface-variant">{row.action}</code>
                        )}
                      </td>
                      <td className="p-4"><Identifier value={row.pseudonym} viewer={viewerPseudonym} /></td>
                      <td className="p-4"><Identifier value={row.record} /></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
        {!error && visibleCount >= limit && (
          <div className="border-t border-outline-variant bg-surface p-3 text-center">
            <button
              type="button"
              onClick={() => setLimit((current) => current + PAGE)}
              aria-busy={loading || undefined}
              className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-secondary hover:underline"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
              Load {PAGE} more
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
