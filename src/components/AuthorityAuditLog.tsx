import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetchAllRows";
import type { Tables } from "@/integrations/supabase/types";
import { Time } from "@/components/Time";
import { Button } from "@/components/ui/button";
import { abbreviateIdentifier } from "@/lib/format";
import { ROUTES } from "@/lib/routes";

type AuditEvent = Tables<"election_authority_audit_log">;

/** Audit actions in operator language; the raw identifier stays visible for cross-referencing exports. */
const ACTION_LABELS: Record<string, string> = {
  AUTHENTICATION: "Signed in",
  CLOSE_ELECTION: "Closed an election early",
  UPDATE_ELECTION: "Edited election details",
  STORE_TALLY: "Published a tally",
  REPLACE_TALLY: "Replaced a tally",
  LINK_AUTHORITY: "Linked the authority identity",
};

export default function AuthorityAuditLog() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    const loadEvents = async () => {
      const rows = await fetchAllRows((from, to) =>
        supabase.from("election_authority_audit_log").select("*").order("performed_at", { ascending: false }).range(from, to)
      );
      if (!cancelled) setEvents(rows);
    };
    void loadEvents()
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const exportEvents = () => {
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `votex-authority-audit-${new Date().toISOString()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="ledger-panel p-6 sm:p-8" aria-labelledby="audit-log-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="ledger-eyebrow">Election Authority</p>
          <h1 id="audit-log-title" className="mt-2 flex items-center gap-3 font-headline text-3xl font-bold tracking-display text-primary">
            <History className="h-7 w-7" aria-hidden="true" /> Audit log
          </h1>
          <p className="mt-2 text-sm text-on-surface-variant">Every operator action, newest first. Voters see the election-specific entries in each election&apos;s public records.</p>
        </div>
        <Button variant="outline" onClick={exportEvents} aria-disabled={events.length === 0 || undefined}>
          <Download className="h-4 w-4" aria-hidden="true" /> Export JSON
        </Button>
      </div>
      {loading && (
        <p className="mt-8 text-on-surface-variant" role="status">
          Loading audit events…
        </p>
      )}
      {error && (
        <div className="mt-8 rounded-xl bg-error-container p-4 text-on-error-container" role="alert">
          <p>The audit log could not be loaded.</p>
          <Button variant="outline" className="mt-3" onClick={() => setReloadKey((k) => k + 1)}>
            Retry
          </Button>
        </div>
      )}
      {!loading && !error && events.length === 0 && <p className="mt-8 text-on-surface-variant">No operator actions have been recorded yet.</p>}
      <ol className="mt-8 space-y-3">
        {events.map((event) => (
          <li key={event.id} className="rounded-lg bg-surface-container-low p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold text-primary">
                {ACTION_LABELS[event.action] ?? event.action}
                {ACTION_LABELS[event.action] && <code className="civic-mono ml-2 text-xs text-on-surface-variant">{event.action}</code>}
              </h2>
              <Time value={event.performed_at} className="text-xs text-on-surface-variant" />
            </div>
            <p className="mt-2 text-sm text-on-surface-variant">By {event.performed_by}</p>
            {event.election_id && (
              <p className="mt-1 text-xs text-on-surface-variant">
                Election{" "}
                <Link to={ROUTES.authorityElection(event.election_id)} className="civic-mono font-semibold text-secondary hover:underline" title={event.election_id}>
                  {abbreviateIdentifier(event.election_id, 8)}
                </Link>
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
