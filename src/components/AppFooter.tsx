import { Link, useLocation } from "react-router-dom";
import { Mail } from "lucide-react";

export default function AppFooter() {
  const location = useLocation();
  const isAuthorityPage =
    location.pathname === "/election_authority" || location.pathname.endsWith("/authority");

  if (isAuthorityPage) return null;

  return (
    <footer className="mb-20 mt-auto border-t border-outline-variant bg-surface-container-low md:mb-0">
      <div className="civic-container flex flex-col gap-6 py-8 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="civic-label font-bold text-primary">Votex</p>
          <p className="mt-2 text-sm text-on-surface-variant">
            Verifiable public voting for pseudonymous participants.
          </p>
        </div>
        <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-on-surface-variant">
          <Link to="/privacy" className="hover:text-primary">Privacy</Link>
          <Link to="/audit-protocol" aria-label="Public verification guide" className="hover:text-primary">Audit Protocol</Link>
          <a href="mailto:support@votex.world" aria-label="Contact the Votex team" className="inline-flex items-center gap-1.5 hover:text-primary">
            <Mail className="h-4 w-4" aria-hidden="true" /> Support
          </a>
          <Link to="/election_authority" className="hover:text-primary">Operator Entrance</Link>
        </nav>
      </div>
    </footer>
  );
}
