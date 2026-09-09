import { Link } from "react-router-dom";
import { ArrowLeft, Compass, ShieldCheck } from "lucide-react";

const NotFound = () => {
  return (
    <div className="civic-container pb-28 pt-10 md:pb-12">
      <div className="mx-auto max-w-4xl">
        <section className="civic-card p-8 md:p-12">
          <div className="max-w-3xl">
            <span className="ledger-badge bg-secondary-container text-on-secondary-container">
              <ShieldCheck className="h-4 w-4" />
              Route unavailable
            </span>
            <h1 className="mt-5 font-headline text-3xl font-bold tracking-[-0.03em] text-primary sm:text-4xl">
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
