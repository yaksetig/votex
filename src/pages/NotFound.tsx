import { Link, useLocation } from "react-router-dom";
import { Compass, Home } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { ROUTES } from "@/lib/routes";

const NotFound = () => {
  usePageTitle("Page not found");
  const { pathname } = useLocation();

  return (
    <div className="civic-container pb-12 pt-10">
      <div className="mx-auto max-w-3xl">
        <section className="ledger-panel p-8 md:p-12">
          <p className="ledger-eyebrow">Error 404</p>
          <h1 className="mt-3 font-headline text-3xl font-bold tracking-[-0.03em] text-primary sm:text-4xl">Page not found</h1>
          <p className="mt-4 text-lg leading-relaxed text-on-surface-variant">
            There is nothing at <code className="civic-mono break-all text-primary">{pathname}</code>. The link may be out of
            date, or the address may have been typed incorrectly.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to={ROUTES.elections} className="ledger-button-primary">
              <Compass className="h-4 w-4" aria-hidden="true" />
              Go to elections
            </Link>
            <Link to={ROUTES.home} className="ledger-button-secondary">
              <Home className="h-4 w-4" aria-hidden="true" />
              Go home
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default NotFound;
