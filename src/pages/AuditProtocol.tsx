import { Link } from "react-router-dom";
import { getExplainerSection } from "@/content/howItWorks";
import { usePageTitle } from "@/hooks/usePageTitle";
import { ROUTES } from "@/lib/routes";

/** Standalone audit page for observers; same copy as the guide section. */
export default function AuditProtocol() {
  usePageTitle("Audit protocol");
  const section = getExplainerSection("audit");
  return (
    <div className="civic-container pb-12 pt-10">
      <section className="ledger-panel mx-auto max-w-4xl p-6 sm:p-10" aria-labelledby="audit-title">
        <p className="ledger-eyebrow text-secondary">Public verification</p>
        <h1 id="audit-title" className="mt-3 font-headline text-3xl font-bold tracking-display text-primary">
          {section.title}
        </h1>
        <p className="mt-2 text-sm font-semibold text-secondary">{section.summary}</p>
        <div className="mt-6 space-y-5">{section.body}</div>
        <p className="mt-8 text-sm text-on-surface-variant">
          Part of{" "}
          <Link to={ROUTES.howItWorks} className="font-semibold text-secondary underline-offset-4 hover:underline">
            how Votex works
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
