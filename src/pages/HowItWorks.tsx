import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { EXPLAINER_SECTIONS } from "@/content/howItWorks";
import { usePageTitle } from "@/hooks/usePageTitle";
import { ROUTES } from "@/lib/routes";
import { PageHeader } from "@/components/PageHeader";

/**
 * The one explainer page. Every section has an anchor so other pages can
 * deep-link (for example the ballot panel links to #privacy and the
 * nullification panel to #pressure).
 */
const HowItWorks = () => {
  usePageTitle("How Votex works");
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const target = document.getElementById(hash.slice(1));
    if (target) {
      target.scrollIntoView({ block: "start" });
      target.focus({ preventScroll: true });
    }
  }, [hash]);

  return (
    <div className="civic-container pb-12 pt-10">
      <PageHeader
        eyebrow="Guide"
        title="How Votex works"
        description="Votex runs public, verifiable elections. Each person proves they are unique with World ID, votes with a key derived from their own passkey, and can later cancel that ballot with a request nobody can tell apart from a decoy. This page explains each part and what it does and does not protect."
      />

      <div className="mt-8 grid gap-10 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav aria-label="On this page" className="lg:sticky lg:top-24 lg:self-start">
          <p className="ledger-eyebrow">On this page</p>
          <ol className="mt-3 space-y-1 border-l border-outline-variant">
            {EXPLAINER_SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="-ml-px block border-l-2 border-transparent py-2 pl-4 text-sm text-on-surface-variant hover:border-secondary hover:text-primary"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="min-w-0 space-y-6">
          {EXPLAINER_SECTIONS.map((section) => (
            <section
              key={section.id}
              id={section.id}
              tabIndex={-1}
              aria-labelledby={`${section.id}-title`}
              className="ledger-panel scroll-mt-24 p-6 outline-none sm:p-8"
            >
              <h2 id={`${section.id}-title`} className="font-headline text-2xl font-bold text-primary">
                {section.title}
              </h2>
              <p className="mt-2 text-sm font-semibold text-secondary">{section.summary}</p>
              <div className="mt-5 space-y-4">{section.body}</div>
            </section>
          ))}

          <div className="flex flex-col gap-3 rounded-xl bg-surface-container-low p-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-on-surface-variant">Still have a question? The FAQ covers the short practical ones.</p>
            <Link to={ROUTES.faq} className="ledger-button-secondary shrink-0">
              Read the FAQ <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HowItWorks;
