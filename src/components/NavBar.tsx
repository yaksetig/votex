import React from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  CircleHelp,
  Compass,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  UserCircle2,
  Vote,
} from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { cn } from "@/lib/utils";

const VOTER_MOBILE_NAV = [
  { to: "/elections", label: "Home", icon: Compass, match: (path: string) => path === "/elections" },
  {
    to: "/elections",
    label: "Vote",
    icon: Vote,
    match: (path: string) => path.startsWith("/elections/") && !path.endsWith("/authority"),
  },
  { to: "/how-it-works", label: "Protocol", icon: ShieldCheck, match: (path: string) => path === "/how-it-works" },
  { to: "/dashboard", label: "Profile", icon: UserCircle2, match: (path: string) => path === "/dashboard" },
];

const NavBar = () => {
  const { isWorldIDVerified, resetIdentity } = useWallet();
  const location = useLocation();
  const navigate = useNavigate();

  const isAuthorityPage =
    location.pathname === "/election_authority" || location.pathname.endsWith("/authority");
  const isIdentityPage = location.pathname === "/dashboard" || location.pathname === "/success";
  const showSearch = location.pathname === "/elections";

  const handleSignOut = () => {
    void resetIdentity();
    navigate("/dashboard", { replace: true });
  };

  if (isAuthorityPage) {
    return null;
  }

  return (
    <>
      <header className="ledger-topbar">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4 px-4 py-3 font-headline sm:px-6">
          <div className="flex items-center gap-8">
            <NavLink
              to={isIdentityPage ? "/dashboard" : "/elections"}
              className="text-xl font-extrabold tracking-tight text-slate-900"
            >
              Votex
            </NavLink>

            {!isIdentityPage && (
              <nav className="hidden items-center gap-6 text-sm font-semibold md:flex">
                <NavLink
                  to="/elections"
                  className={({ isActive }) =>
                    cn(
                      "border-b-2 pb-1 transition-colors",
                      isActive ? "border-surface-tint text-surface-tint" : "border-transparent text-on-surface-variant hover:text-primary"
                    )
                  }
                >
                  Elections
                </NavLink>
                <NavLink
                  to="/how-it-works"
                  className={({ isActive }) =>
                    cn(
                      "border-b-2 pb-1 transition-colors",
                      isActive ? "border-surface-tint text-surface-tint" : "border-transparent text-on-surface-variant hover:text-primary"
                    )
                  }
                >
                  Audit Protocol
                </NavLink>
                <NavLink
                  to="/dashboard"
                  className={({ isActive }) =>
                    cn(
                      "border-b-2 pb-1 transition-colors",
                      isActive ? "border-surface-tint text-surface-tint" : "border-transparent text-on-surface-variant hover:text-primary"
                    )
                  }
                >
                  Identity
                </NavLink>
              </nav>
            )}
          </div>

          <div className="flex items-center gap-3">
            {showSearch && (
              <div className="hidden min-w-[260px] items-center rounded-full border border-outline-variant/20 bg-surface-container-low px-4 py-2 sm:flex">
                <span className="text-sm text-on-surface-variant">Search elections...</span>
              </div>
            )}

            {isIdentityPage ? (
              <NavLink
                to="/how-it-works"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary"
              >
                <CircleHelp className="h-5 w-5" />
              </NavLink>
            ) : (
              <>
                <button
                  type="button"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-primary"
                >
                  <Bell className="h-5 w-5" />
                </button>

                {isWorldIDVerified ? (
                  <>
                    <div className="hidden items-center gap-2 rounded-full bg-secondary-container px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-on-secondary-container sm:flex">
                      <ShieldCheck className="h-4 w-4" />
                      Verified Human
                    </div>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-error"
                    >
                      <LogOut className="h-5 w-5" />
                    </button>
                  </>
                ) : (
                  <NavLink to="/dashboard" className="ledger-button-secondary hidden sm:inline-flex">
                    <LayoutDashboard className="h-4 w-4" />
                    Secure Sign In
                  </NavLink>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      {!isIdentityPage && (
        <nav className="fixed bottom-0 left-0 z-40 flex w-full items-center justify-around border-t border-outline-variant/15 bg-white/90 px-4 pb-5 pt-2 backdrop-blur-xl md:hidden">
          {VOTER_MOBILE_NAV.map(({ to, label, icon: Icon, match }) => {
            const active = match(location.pathname);
            return (
              <NavLink
                key={label}
                to={to}
                className={cn(
                  "flex flex-col items-center justify-center rounded-2xl px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] transition-all",
                  active
                    ? "bg-primary-fixed text-primary"
                    : "text-on-surface-variant"
                )}
              >
                <Icon className="mb-1 h-5 w-5" />
                {label}
              </NavLink>
            );
          })}
          {isWorldIDVerified && (
            <button
              type="button"
              onClick={handleSignOut}
              className="flex flex-col items-center justify-center rounded-2xl px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-on-surface-variant"
            >
              <LogOut className="mb-1 h-5 w-5" />
              Exit
            </button>
          )}
        </nav>
      )}
    </>
  );
};

export default NavBar;
