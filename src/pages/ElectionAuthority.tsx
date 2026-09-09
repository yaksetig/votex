import React, { Suspense, lazy, useEffect, useState } from "react";
import {
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
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const ElectionAuthorityLogin = lazy(() => import("@/components/ElectionAuthorityLogin"));
const ElectionAuthorityDashboard = lazy(() => import("@/components/ElectionAuthorityDashboard"));
const AuthorityElectionsList = lazy(() => import("@/components/AuthorityElectionsList"));
const AuthorityAuditLog = lazy(() => import("@/components/AuthorityAuditLog"));

const AUTHORITY_NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "audit", label: "Audit Logs", icon: History },
] as const;

interface AuthorityShellProps {
  authorityName: string;
  activeItem: string;
  onNavigate: (item: "dashboard" | "audit") => void;
  onLogout: () => void;
  children: React.ReactNode;
}

const AuthorityPaneLoading = () => (
  <div className="flex min-h-[40vh] items-center justify-center">
    <div className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest px-8 py-10 text-center shadow-ledger">
      <p className="ledger-eyebrow">Authority workspace</p>
      <h2 className="mt-3 font-headline text-2xl font-bold text-primary">
        Loading view
      </h2>
    </div>
  </div>
);

const AuthorityShell: React.FC<AuthorityShellProps> = ({
  authorityName,
  activeItem,
  onLogout,
  onNavigate,
  children,
}) => {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-outline-variant bg-surface px-4 lg:hidden">
        <div>
          <p className="font-headline text-lg font-bold text-primary">Votex Authority</p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-secondary">Secure session active</p>
        </div>
        <button type="button" onClick={onLogout} aria-label="Log out" className="flex h-10 w-10 items-center justify-center rounded-lg text-error hover:bg-error-container">
          <LogOut className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      <aside className="fixed left-0 top-0 hidden h-screen w-64 border-r border-outline-variant bg-surface px-4 py-6 lg:flex lg:flex-col">
        <div className="mb-8 px-3 pt-2">
          <h1 className="font-headline text-xl font-bold tracking-[-0.02em] text-primary">Votex</h1>
          <p className="mt-1 text-sm text-on-surface-variant">Authority Portal</p>
        </div>

        <div className="mb-8 rounded-xl bg-primary p-4 text-on-primary">
          <p className="civic-label text-white/55">Authenticated authority</p>
          <p className="mt-2 font-headline text-xl font-bold text-white">{authorityName}</p>
          <p className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-secondary-fixed"><span className="h-2 w-2 rounded-full bg-secondary-fixed" />Session active</p>
        </div>

        <nav className="flex-1 space-y-1">
          {AUTHORITY_NAV.map(({ id, label, icon: Icon }) => (
            <button
              type="button"
              key={id}
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

        <div className="mt-auto space-y-3 border-t border-outline-variant/15 pt-4">
          <a
            href="mailto:support@votex.world"
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low"
          >
            <HelpCircle className="h-4 w-4" />
            Support
          </a>
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-error transition-colors hover:bg-error-container/60"
          >
            <LogOut className="h-4 w-4" />
            Log Out
          </button>
        </div>
      </aside>

      <main className="px-4 pb-28 pt-8 lg:ml-64 lg:px-10 lg:pb-10">
        <div className="mx-auto max-w-[1200px]">{children}</div>
      </main>

      <nav aria-label="Authority mobile navigation" className="fixed bottom-0 left-0 z-50 flex w-full items-center justify-around border-t border-outline-variant bg-surface px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 lg:hidden">
        {AUTHORITY_NAV.map(({ id, label, icon: Icon }) => (
          <button
            type="button"
            key={id}
            onClick={() => onNavigate(id)}
            className={cn(
              "flex min-w-24 flex-col items-center rounded-full px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.05em]",
              activeItem === id ? "bg-secondary-container text-on-secondary-container" : "text-on-surface-variant"
            )}
          >
            <Icon className="mb-1 h-5 w-5" aria-hidden="true" />{label}
          </button>
        ))}
        <a href="mailto:support@votex.world" className="flex min-w-24 flex-col items-center rounded-full px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-on-surface-variant">
          <HelpCircle className="mb-1 h-5 w-5" aria-hidden="true" />Support
        </a>
      </nav>
    </div>
  );
};

const ElectionAuthority = () => {
  const [authorityId, setAuthorityId] = useState<string | null>(null);
  const [authorityName, setAuthorityName] = useState<string | null>(null);
  const [selectedElectionId, setSelectedElectionId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"dashboard" | "audit">("dashboard");
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const { toast } = useToast();

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
        setSelectedElectionId(null);
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
    setSelectedElectionId(null);
    toast({
      title: "Logged out",
      description: "You have been securely logged out.",
    });
  };

  if (isCheckingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest px-8 py-10 text-center shadow-ledger">
          <p className="ledger-eyebrow">Authority gateway</p>
          <h1 className="mt-3 font-headline text-3xl font-bold text-primary">Checking session integrity</h1>
        </div>
      </div>
    );
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
      onNavigate={(view) => {
        setSelectedElectionId(null);
        setActiveView(view);
      }}
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
