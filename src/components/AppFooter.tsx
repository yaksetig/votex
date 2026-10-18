import { Link, useLocation } from "react-router-dom";
import { Mail } from "lucide-react";
import { ROUTES, isAuthorityRoute } from "@/lib/routes";

const FOOTER_LINKS = [
  { to: ROUTES.elections, label: "Elections" },
  { to: ROUTES.howItWorks, label: "How it works" },
  { to: ROUTES.faq, label: "FAQ" },
  { to: ROUTES.privacy, label: "Privacy" },
  { to: ROUTES.auditProtocol, label: "Audit protocol" },
] as const;

export default function AppFooter() {
  const location = useLocation();
  if (isAuthorityRoute(location.pathname)) return null;

  return (
    <footer className="mt-auto border-t border-outline-variant bg-surface-container-low">
      <div className="civic-container flex flex-col gap-6 py-8 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="ledger-eyebrow font-bold text-primary">Votex</p>
          <p className="mt-2 max-w-xs text-sm text-on-surface-variant">
            Public, verifiable elections for pseudonymous participants.
          </p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm text-on-surface-variant sm:flex sm:flex-wrap sm:gap-x-6">
          {FOOTER_LINKS.map(({ to, label }) => (
            <Link key={to} to={to} className="inline-flex min-h-11 items-center hover:text-primary sm:min-h-0">
              {label}
            </Link>
          ))}
          <a href="mailto:support@votex.world" className="inline-flex min-h-11 items-center gap-1.5 hover:text-primary sm:min-h-0">
            <Mail className="h-4 w-4" aria-hidden="true" /> Support
          </a>
          <Link to={ROUTES.authority} className="inline-flex min-h-11 items-center hover:text-primary sm:min-h-0">
            Election Authority sign-in
          </Link>
        </nav>
      </div>
    </footer>
  );
}
