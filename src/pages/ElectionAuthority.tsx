import React, { Suspense, lazy, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ROUTES } from "@/lib/routes";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
  ArrowLeft,
  HelpCircle,
  History,
  LayoutDashboard,
  LogOut,
} from "lucide-react";
import {
  clearElectionAuthoritySession,
  onAuthorityAuthStateChange,
  validateElectionAuthoritySession,
} from "@/services/electionAuthoritySessionService";
import { getCurrentAuthority } from "@/services/electionAuthorityAuthService";
import { cn } from "@/lib/utils";
import { LoadingPanel } from "@/components/LoadingPanel";

const ElectionAuthorityLogin = lazy(() => import("@/components/ElectionAuthorityLogin"));
const ElectionAuthorityDashboard = lazy(() => import("@/components/ElectionAuthorityDashboard"));
const AuthorityElectionsList = lazy(() => import("@/components/AuthorityElectionsList"));
const AuthorityAuditLog = lazy(() => import("@/components/AuthorityAuditLog"));

const AUTHORITY_NAV = [
  { id: "dashboard", label: "Elections", icon: LayoutDashboard },
  { id: "audit", label: "Audit log", icon: History },
] as const;

interface AuthorityShellProps {
  authorityName: string;
  activeItem: string;
  onNavigate: (item: "dashboard" | "audit") => void;
  onLogout: () => void;
  children: React.ReactNode;
}

const AuthorityPaneLoading = () => <LoadingPanel label="Loading view" fullHeight={false} />;

const AuthorityShell: React.FC<AuthorityShellProps> = ({
  authorityName,
  activeItem,
  onLogout,
  onNavigate,
  children,
}) => {
  return (
    <div className="min-h-screen bg-background pb-[4.5rem] lg:pb-0">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-outline-variant bg-surface px-4 lg:hidden">
        <div className="flex items-center gap-3">
          <Link to={ROUTES.home} aria-label="Back to Votex" className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-low">
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
          <div>
            <p className="font-headline text-lg font-bold text-primary">Election Authority</p>
            <p className="text-xs font-semibold text-on-surface-variant">{authorityName}</p>
          </div>
        </div>
        <button type="button" onClick={onLogout} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-error hover:bg-error-container">
          <LogOut className="h-5 w-5" aria-hidden="true" />
          Sign out
        </button>
      </header>

      <aside className="fixed left-0 top-0 hidden h-screen w-64 border-r border-outline-variant bg-surface px-4 py-6 lg:flex lg:flex-col">
        <div className="mb-8 px-3 pt-2">
          <p className="font-headline text-xl font-bold tracking-display text-primary">Votex</p>
          <p className="mt-1 text-sm text-on-surface-variant">Election Authority console</p>
          <Link to={ROUTES.home} className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-secondary hover:text-primary">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to Votex
          </Link>
        </div>

        <div className="mb-8 rounded-xl bg-primary p-4 text-on-primary">
          <p className="ledger-eyebrow text-white/70">Election Authority</p>
          <p className="mt-2 font-headline text-xl font-bold text-white">{authorityName}</p>
          <p className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-secondary-fixed"><span className="h-2 w-2 rounded-full bg-secondary-fixed" aria-hidden="true" />Signed in</p>
        </div>

        <nav className="flex-1 space-y-1" aria-label="Election Authority">
          {AUTHORITY_NAV.map(({ id, label, icon: Icon }) => (
            <button
              type="button"
              key={id}
              aria-current={activeItem === id ? "page" : undefined}
              onClick={() => onNavigate(id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-full px-4 py-3 text-sm font-medium transition-colors",
                activeItem === id
                  ? "bg-secondary-container text-on-secondary-container"
                  : "text-on-surface-variant hover:bg-surface-container-high"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>

        <div className="mt-auto space-y-3 border-t border-outline-variant pt-4">
          <a
            href="mailto:support@votex.world"
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low"
          >
            <HelpCircle className="h-4 w-4" aria-hidden="true" />
            Support
          </a>
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-error transition-colors hover:bg-error-container/60"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Not a <main>: the app shell already provides the main landmark. */}
      <div className="px-4 pb-10 pt-8 lg:ml-64 lg:px-10">
        <div className="mx-auto max-w-[1200px]">{children}</div>
      </div>

      <nav aria-label="Election Authority" className="fixed bottom-0 left-0 z-50 flex h-[4.5rem] w-full items-center justify-around border-t border-outline-variant bg-surface px-2 pb-[env(safe-area-inset-bottom)] lg:hidden">
        {AUTHORITY_NAV.map(({ id, label, icon: Icon }) => (
          <button
            type="button"
            key={id}
            aria-current={activeItem === id ? "page" : undefined}
            onClick={() => onNavigate(id)}
            className={cn(
              "flex min-h-11 min-w-20 flex-col items-center justify-center rounded-lg px-3 py-1 text-xs font-semibold",
              activeItem === id ? "text-secondary" : "text-on-surface-variant"
            )}
          >
            <Icon className="mb-1 h-5 w-5" aria-hidden="true" />{label}
          </button>
        ))}
        <a href="mailto:support@votex.world" className="flex min-h-11 min-w-20 flex-col items-center justify-center rounded-lg px-3 py-1 text-xs font-semibold text-on-surface-variant">
          <HelpCircle className="mb-1 h-5 w-5" aria-hidden="true" />Support
        </a>
      </nav>
    </div>
  );
};

const ElectionAuthority = () => {
  const [authorityId, setAuthorityId] = useState<string | null>(null);
  const [authorityName, setAuthorityName] = useState<string | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const navigate = useNavigate();
  const { id: routeElectionId } = useParams();
  const [searchParams] = useSearchParams();
  // The URL is the source of truth: /authority/elections/:id opens one
  // election, /authority?view=audit opens the audit log.
  const selectedElectionId = routeElectionId ?? null;
  const activeView: "dashboard" | "audit" = searchParams.get("view") === "audit" ? "audit" : "dashboard";
  const setSelectedElectionId = (id: string | null) => navigate(id ? ROUTES.authorityElection(id) : ROUTES.authority);
  const setActiveView = (view: "dashboard" | "audit") => navigate(view === "audit" ? `${ROUTES.authority}?view=audit` : ROUTES.authority);
  usePageTitle(selectedElectionId ? "Election · Election Authority" : activeView === "audit" ? "Audit log · Election Authority" : "Election Authority");

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      try {
        const result = await validateElectionAuthoritySession();
        if (!cancelled && result.valid && result.authorityId) {
          setAuthorityId(result.authorityId);
          const authority = await getCurrentAuthority();
          if (authority && !cancelled) {
            setAuthorityName(authority.authorityName);
          }
        }
      } finally {
        if (!cancelled) {
          setIsCheckingSession(false);
        }
      }
    };

    void checkSession();

    const unsubscribe = onAuthorityAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setAuthorityId(null);
        setAuthorityName(null);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const handleLoginSuccess = (authId: string, authName: string) => {
    setAuthorityId(authId);
    setAuthorityName(authName);
  };

  const handleLogout = async () => {
    await clearElectionAuthoritySession();
    setAuthorityId(null);
    setAuthorityName(null);
    navigate(ROUTES.authority, { replace: true });
  };

  if (isCheckingSession) {
    return <LoadingPanel label="Checking your session" />;
  }

  if (!authorityId) {
    return (
      <Suspense fallback={<AuthorityPaneLoading />}>
        <ElectionAuthorityLogin onLoginSuccess={handleLoginSuccess} />
      </Suspense>
    );
  }

  return (
    <AuthorityShell
      authorityName={authorityName || "Election Authority"}
      activeItem={selectedElectionId ? "management" : activeView}
      onLogout={handleLogout}
      onNavigate={(view) => setActiveView(view)}
    >
      <Suspense fallback={<AuthorityPaneLoading />}>
        {selectedElectionId ? (
          <ElectionAuthorityDashboard
            electionId={selectedElectionId}
            authorityName={authorityName || "Election Authority"}
            onBack={() => setSelectedElectionId(null)}
          />
        ) : activeView === "audit" ? (
          <AuthorityAuditLog />
        ) : (
          <AuthorityElectionsList
            authorityId={authorityId}
            authorityName={authorityName || "Election Authority"}
            onElectionSelect={setSelectedElectionId}
          />
        )}
      </Suspense>
    </AuthorityShell>
  );
};

export default ElectionAuthority;
