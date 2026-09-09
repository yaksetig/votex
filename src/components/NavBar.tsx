import { NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  ClipboardCheck,
  Compass,
  Home,
  LogOut,
  Search,
  ShieldCheck,
  UserCircle2,
} from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { cn } from "@/lib/utils";

const MOBILE_NAV = [
  { to: "/", label: "Home", icon: Home, match: (path: string) => path === "/" },
  {
    to: "/elections",
    label: "Vote",
    icon: Compass,
    match: (path: string) => path.startsWith("/elections") && !path.endsWith("/authority"),
  },
  {
    to: "/audit-protocol",
    label: "Audit",
    icon: ClipboardCheck,
    match: (path: string) => path === "/audit-protocol" || path.startsWith("/receipts/"),
  },
  {
    to: "/dashboard",
    label: "Profile",
    icon: UserCircle2,
    match: (path: string) => path === "/dashboard" || path === "/success",
  },
] as const;

const NavBar = () => {
  const { isWorldIDVerified, resetIdentity } = useWallet();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const isAuthorityPage =
    location.pathname === "/election_authority" || location.pathname.endsWith("/authority");
  const showSearch = location.pathname === "/elections";

  if (isAuthorityPage) return null;

  const handleSignOut = () => {
    void resetIdentity();
    navigate("/dashboard", { replace: true });
  };

  const desktopLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "border-b-2 py-1 text-sm font-semibold transition-colors",
      isActive
        ? "border-secondary text-secondary"
        : "border-transparent text-on-surface-variant hover:text-secondary"
    );

  return (
    <>
      <header className="ledger-topbar">
        <div className="civic-container flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <NavLink to="/" className="font-headline text-xl font-bold tracking-[-0.02em] text-primary">
              Votex
            </NavLink>
            <nav aria-label="Primary navigation" className="hidden items-center gap-6 md:flex">
              <NavLink to="/elections" className={desktopLinkClass}>Elections</NavLink>
              <NavLink to="/how-it-works" className={desktopLinkClass}>How It Works</NavLink>
              <NavLink to="/faq" className={desktopLinkClass}>FAQ</NavLink>
            </nav>
          </div>

          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {showSearch && (
              <label className="hidden items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2 lg:flex">
                <span className="sr-only">Search elections</span>
                <Search className="h-4 w-4 text-outline" aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Search elections..."
                  value={searchParams.get("q") ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSearchParams(value ? { q: value } : {}, { replace: true });
                  }}
                  className="w-48 bg-transparent text-sm text-primary outline-none placeholder:text-on-surface-variant"
                />
              </label>
            )}

            {isWorldIDVerified ? (
              <>
                <NavLink
                  to="/dashboard"
                  className="hidden items-center gap-2 rounded-full bg-secondary-container px-4 py-2 text-xs font-semibold text-on-secondary-container sm:inline-flex"
                >
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  Verified Human
                </NavLink>
                <button
                  type="button"
                  onClick={handleSignOut}
                  aria-label="Sign out"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-low hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
                >
                  <LogOut className="h-5 w-5" aria-hidden="true" />
                </button>
              </>
            ) : (
              <NavLink to="/dashboard" className="inline-flex min-h-10 items-center px-3 text-sm font-semibold text-secondary hover:bg-surface-container-low sm:px-4">
                Sign In
              </NavLink>
            )}
          </div>
        </div>
      </header>

      <nav
        aria-label="Mobile navigation"
        className="fixed bottom-0 left-0 z-40 flex w-full items-center justify-around border-t border-outline-variant bg-surface/95 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-4px_20px_rgba(9,20,38,0.06)] backdrop-blur-md md:hidden"
      >
        {MOBILE_NAV.map(({ to, label, icon: Icon, match }) => {
          const active = match(location.pathname);
          return (
            <NavLink
              key={label}
              to={to}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-w-16 flex-col items-center justify-center rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.05em] transition-colors",
                active
                  ? "bg-secondary-container text-on-secondary-container"
                  : "text-on-surface-variant hover:bg-surface-container-low"
              )}
            >
              <Icon className="mb-1 h-5 w-5" aria-hidden="true" />
              {label}
            </NavLink>
          );
        })}
      </nav>
    </>
  );
};

export default NavBar;
