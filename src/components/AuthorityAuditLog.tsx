import { useEffect, useState } from "react";
import { Download, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type AuditEvent = Tables<"election_authority_audit_log">;

export default function AuthorityAuditLog() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadEvents = async () => {
      const rows: AuditEvent[] = [];
      const pageSize = 1000;
      for (let offset = 0; ; offset += pageSize) {
        const { data, error: queryError } = await supabase
          .from("election_authority_audit_log")
          .select("*")
          .order("performed_at", { ascending: false })
          .range(offset, offset + pageSize - 1);
        if (queryError) throw queryError;
        rows.push(...(data ?? []));
        if (!data || data.length < pageSize) break;
      }
      if (!cancelled) setEvents(rows);
    };

    void loadEvents()
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Audit log could not be loaded");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

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
    <section className="ledger-panel p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="ledger-eyebrow">Fixed authority</p>
          <h1 className="mt-2 flex items-center gap-3 font-headline text-3xl font-extrabold text-primary">
            <History className="h-7 w-7" aria-hidden="true" /> Audit log
          </h1>
        </div>
        <button type="button" className="ledger-button-secondary" onClick={exportEvents} disabled={events.length === 0}>
          <Download className="h-4 w-4" aria-hidden="true" /> Export JSON
        </button>
      </div>
      {loading && <p className="mt-8 text-on-surface-variant" role="status">Loading audit events…</p>}
      {error && <p className="mt-8 rounded-xl bg-error-container p-4 text-on-error-container" role="alert">{error}</p>}
      {!loading && !error && events.length === 0 && <p className="mt-8 text-on-surface-variant">No authority actions have been recorded.</p>}
      <div className="mt-8 space-y-3">
        {events.map((event) => (
          <article key={event.id} className="rounded-[1.25rem] bg-surface-container-low p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold text-primary">{event.action}</h2>
              <time className="text-xs text-on-surface-variant">{new Date(event.performed_at).toLocaleString()}</time>
            </div>
            <p className="mt-2 text-sm text-on-surface-variant">Performed by {event.performed_by}</p>
            {event.election_id && <p className="mt-1 break-all font-mono text-xs text-on-surface-variant">Election {event.election_id}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}
