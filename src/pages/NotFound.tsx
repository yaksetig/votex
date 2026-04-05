import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, Compass, ShieldCheck } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="px-4 pb-24 pt-10 sm:px-6 md:pb-10">
      <div className="mx-auto max-w-5xl">
        <section className="ledger-panel relative overflow-hidden p-8 md:p-12">
          <div className="absolute -right-8 top-0 h-64 w-64 rounded-full bg-primary-fixed-dim/55 blur-[100px]" />
          <div className="relative z-10 max-w-3xl">
            <span className="ledger-badge bg-secondary-container text-on-secondary-container">
              <ShieldCheck className="h-4 w-4" />
              Route unavailable
            </span>
            <h1 className="mt-5 font-headline text-5xl font-extrabold tracking-tight text-primary md:text-6xl">
              This ledger entry does not exist.
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-on-surface-variant">
              The page you requested is not part of the current Votex interface. Return to the authenticated dashboard or continue into the election browser.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/dashboard" className="ledger-button-primary">
                <ArrowLeft className="h-4 w-4" />
                Back to Identity
              </Link>
              <Link to="/elections" className="ledger-button-secondary">
                <Compass className="h-4 w-4" />
                Open Elections
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default NotFound;
