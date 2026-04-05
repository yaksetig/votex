import React, { Suspense, lazy, useEffect, useState } from "react";
import {
  BarChart3,
  HelpCircle,
  History,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Vote,
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

const AUTHORITY_NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "management", label: "Election Management", icon: Vote },
  { id: "tally", label: "Tally Processing", icon: BarChart3 },
  { id: "audit", label: "Audit Logs", icon: History },
  { id: "security", label: "Security Settings", icon: ShieldCheck },
];

interface AuthorityShellProps {
  authorityName: string;
  activeItem: string;
  onLogout: () => void;
  children: React.ReactNode;
}

const AuthorityPaneLoading = () => (
  <div className="flex min-h-[40vh] items-center justify-center">
    <div className="rounded-[2rem] border border-outline-variant/15 bg-surface-container-lowest px-8 py-10 text-center shadow-ledger">
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
  children,
}) => {
  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed left-0 top-0 hidden h-screen w-72 border-r border-outline-variant/15 bg-slate-50 px-5 py-6 lg:flex lg:flex-col">
        <div className="mb-10 px-2 pt-4">
          <h1 className="text-lg font-black tracking-tight text-slate-900">Election Authority</h1>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.22em] text-surface-tint">
            Secure Session Active
          </p>
        </div>

        <div className="mb-8 rounded-[1.5rem] bg-primary-container p-4 text-on-primary">
          <p className="ledger-eyebrow text-on-primary-container">Authenticated authority</p>
          <p className="mt-2 font-headline text-xl font-bold text-white">{authorityName}</p>
        </div>

        <nav className="flex-1 space-y-1">
          {AUTHORITY_NAV.map(({ id, label, icon: Icon }) => (
            <div
              key={id}
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-transform duration-200",
                activeItem === id
                  ? "translate-x-1 bg-primary-fixed text-primary"
                  : "text-on-surface-variant hover:translate-x-1 hover:bg-surface-container-low"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </div>
          ))}
        </nav>

        <div className="mt-auto space-y-3 border-t border-outline-variant/15 pt-4">
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low"
          >
            <HelpCircle className="h-4 w-4" />
            Support
          </button>
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

      <main className="px-4 py-8 lg:ml-72 lg:px-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
};

const ElectionAuthority = () => {
  const [authorityId, setAuthorityId] = useState<string | null>(null);
  const [authorityName, setAuthorityName] = useState<string | null>(null);
  const [selectedElectionId, setSelectedElectionId] = useState<string | null>(null);
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
        <div className="rounded-[2rem] border border-outline-variant/15 bg-surface-container-lowest px-8 py-10 text-center shadow-ledger">
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
      activeItem={selectedElectionId ? "management" : "dashboard"}
      onLogout={handleLogout}
    >
      <Suspense fallback={<AuthorityPaneLoading />}>
        {selectedElectionId ? (
          <ElectionAuthorityDashboard
            electionId={selectedElectionId}
            authorityName={authorityName || "Election Authority"}
            onBack={() => setSelectedElectionId(null)}
          />
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
