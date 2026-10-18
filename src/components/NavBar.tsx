import { useState } from "react";
import { NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { BookOpen, CircleHelp, Home, LogOut, Search, UserCircle2, Vote } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { cn } from "@/lib/utils";
import { ROUTES, isAuthorityRoute, signInPath } from "@/lib/routes";
import { ConfirmDialog } from "@/components/ConfirmDialog";

/**
 * One navigation model for every width. The desktop header and the phone
 * bottom bar expose the same destinations: Home, Elections, How Votex works,
 * FAQ, and Profile (or Sign in). Hidden on the Election Authority console,
 * which has its own shell.
 */
const PRIMARY_NAV = [
  { to: ROUTES.elections, label: "Elections", icon: Vote, match: (path: string) => path.startsWith("/elections") || path.startsWith("/receipts/") },
  { to: ROUTES.howItWorks, label: "How it works", icon: BookOpen, match: (path: string) => path === ROUTES.howItWorks || path === ROUTES.privacy || path === ROUTES.auditProtocol },
  { to: ROUTES.faq, label: "FAQ", icon: CircleHelp, match: (path: string) => path === ROUTES.faq },
] as const;

const NavBar = () => {
  const { isWorldIDVerified, resetIdentity } = useWallet();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  if (isAuthorityRoute(location.pathname)) return null;

  const showSearch = location.pathname === ROUTES.elections;
  const onSignIn = location.pathname === ROUTES.signIn;
  const accountItem = isWorldIDVerified
    ? { to: ROUTES.profile, label: "Profile", icon: UserCircle2, match: (path: string) => path === ROUTES.profile }
    : { to: signInPath(location.pathname + location.search), label: "Sign in", icon: UserCircle2, match: (path: string) => path === ROUTES.signIn };

  const desktopLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "inline-flex min-h-11 items-center border-b-2 text-sm font-semibold transition-colors",
      isActive ? "border-secondary text-secondary" : "border-transparent text-on-surface-variant hover:text-secondary"
    );

  return (
    <>
      <header className="ledger-topbar">
        <div className="civic-container flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <NavLink to={ROUTES.home} className="font-headline text-xl font-bold tracking-[-0.02em] text-primary" aria-label="Votex home">
              Votex
            </NavLink>
            <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
              {PRIMARY_NAV.map(({ to, label }) => (
                <NavLink key={to} to={to} className={desktopLinkClass}>
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {showSearch && (
              <label className="hidden items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2 lg:flex">
                <span className="sr-only">Search elections</span>
                <Search className="h-4 w-4 text-on-surface-variant" aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Search elections"
                  value={searchParams.get("q") ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    const next = new URLSearchParams(searchParams);
                    if (value) next.set("q", value);
                    else next.delete("q");
                    setSearchParams(next, { replace: true });
                  }}
                  className="w-48 bg-transparent text-base text-primary outline-none placeholder:text-on-surface-variant md:text-sm"
                />
              </label>
            )}

            {isWorldIDVerified ? (
              <>
                <NavLink
                  to={ROUTES.profile}
                  className={({ isActive }) =>
                    cn(
                      "hidden min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold sm:inline-flex",
                      isActive ? "bg-secondary-container text-on-secondary-container" : "text-on-surface-variant hover:bg-surface-container-low hover:text-primary"
                    )
                  }
                >
                  <UserCircle2 className="h-4 w-4" aria-hidden="true" />
                  Profile
                </NavLink>
                <button
                  type="button"
                  onClick={() => setConfirmSignOut(true)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
                >
                  <LogOut className="h-5 w-5" aria-hidden="true" />
                  <span className="hidden sm:inline">Sign out</span>
                  <span className="sr-only sm:hidden">Sign out</span>
                </button>
              </>
            ) : onSignIn ? null : (
              <NavLink
                to={accountItem.to}
                className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-secondary hover:bg-surface-container-low sm:px-4"
              >
                Sign in
              </NavLink>
            )}
          </div>
        </div>
      </header>

      <nav
        aria-label="Primary"
        className="fixed bottom-0 left-0 z-40 flex h-[var(--bottom-nav-h)] w-full items-center justify-around border-t border-outline-variant bg-surface/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(9,20,38,0.06)] backdrop-blur-md md:hidden"
      >
        {[{ to: ROUTES.home, label: "Home", icon: Home, match: (path: string) => path === ROUTES.home }, ...PRIMARY_NAV, accountItem].map(
          ({ to, label, icon: Icon, match }) => {
            const active = match(location.pathname);
            return (
              <NavLink
                key={label}
                to={to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 min-w-14 flex-col items-center justify-center rounded-lg px-2 py-1 text-xs font-semibold transition-colors",
                  active ? "text-secondary" : "text-on-surface-variant hover:text-primary"
                )}
              >
                <Icon className="mb-0.5 h-5 w-5" aria-hidden="true" />
                {label}
              </NavLink>
            );
          }
        )}
      </nav>

      <ConfirmDialog
        open={confirmSignOut}
        onOpenChange={setConfirmSignOut}
        title="Sign out of Votex?"
        description="Your session ends on this device and the voting key is cleared from this tab. You can sign in again with the same passkey."
        confirmLabel="Sign out"
        busy={signingOut}
        onConfirm={async () => {
          setSigningOut(true);
          try {
            await resetIdentity();
          } finally {
            setSigningOut(false);
            setConfirmSignOut(false);
            navigate(ROUTES.home, { replace: true });
          }
        }}
      />
    </>
  );
};

export default NavBar;
