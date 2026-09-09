import { Suspense, lazy } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Copy,
  Fingerprint,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Vote,
} from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { useDeriveKeypair } from "@/hooks/useDeriveKeypair";
import { useToast } from "@/hooks/use-toast";

const WorldIDSignIn = lazy(() => import("@/components/WorldIDSignIn"));

const Dashboard = () => {
  const navigate = useNavigate();
  const { derivedPublicKey, isWorldIDVerified, userId } = useWallet();
  const { deriveKeypair, isDeriving: isDerivingKey } = useDeriveKeypair();
  const { toast } = useToast();

  if (!isWorldIDVerified || !userId) {
    return (
      <Suspense fallback={<div className="flex min-h-[calc(100vh-64px)] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-secondary" /></div>}>
        <WorldIDSignIn />
      </Suspense>
    );
  }

  const copyCoordinate = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: `${label} copied`, description: "The public coordinate is on your clipboard." });
    } catch {
      toast({ variant: "destructive", title: "Copy failed", description: "Your browser did not allow clipboard access." });
    }
  };

  return (
    <div className="civic-container pb-28 pt-10 md:pb-12">
      <header className="flex flex-col gap-5 border-b border-outline-variant pb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="civic-label text-secondary">My identity</p>
          <h1 className="mt-3 font-headline text-3xl font-bold tracking-[-0.03em] text-primary sm:text-4xl">Your voting profile</h1>
          <p className="mt-3 max-w-2xl text-on-surface-variant">
            World ID is verified. Your passkey reconstructs the signing key locally only when a voting action requires it.
          </p>
        </div>
        <button type="button" onClick={() => navigate("/elections")} className="ledger-button-primary">
          Browse Elections <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-12">
        <aside className="space-y-6 lg:col-span-4">
          <section className="civic-card p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-secondary bg-surface-container text-secondary">
                <ShieldCheck className="h-7 w-7" aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-headline text-xl font-semibold text-primary">Verified Human</h2>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.05em] text-on-surface-variant">World ID session active</p>
              </div>
            </div>
            <dl className="mt-6 space-y-4 border-t border-outline-variant pt-5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-2 text-on-surface-variant"><CheckCircle2 className="h-4 w-4 text-secondary" /> Passkey</dt>
                <dd className="font-semibold text-primary">Active</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-2 text-on-surface-variant"><KeyRound className="h-4 w-4 text-secondary" /> Voting key</dt>
                <dd className="font-semibold text-primary">{derivedPublicKey ? "Ready" : "Locked"}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-xl bg-primary p-6 text-on-primary">
            <p className="civic-label text-secondary-fixed">Active cryptographic identity</p>
            {derivedPublicKey ? (
              <div className="mt-5 space-y-4">
                {(["x", "y"] as const).map((coordinate) => (
                  <div key={coordinate}>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-white/50">Public Key {coordinate.toUpperCase()}</p>
                    <div className="mt-2 flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 p-3">
                      <code className="civic-mono min-w-0 flex-1 truncate text-white">{derivedPublicKey[coordinate]}</code>
                      <button
                        type="button"
                        aria-label={`Copy public key ${coordinate.toUpperCase()}`}
                        onClick={() => void copyCoordinate(`Public key ${coordinate.toUpperCase()}`, derivedPublicKey[coordinate])}
                        className="text-white/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-fixed"
                      >
                        <Copy className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-white/70">Unlock your Votex passkey to reconstruct this session’s signing key.</p>
            )}
          </section>

          <button type="button" onClick={() => void deriveKeypair()} disabled={isDerivingKey} className="ledger-button-secondary w-full">
            {isDerivingKey ? <Loader2 className="h-4 w-4 animate-spin" /> : derivedPublicKey ? <RefreshCw className="h-4 w-4" /> : <Fingerprint className="h-4 w-4" />}
            {isDerivingKey ? "Unlocking..." : derivedPublicKey ? "Re-derive with Passkey" : "Unlock with Passkey"}
          </button>
        </aside>

        <section className="grid gap-6 md:grid-cols-2 lg:col-span-8">
          <article className="civic-card flex min-h-64 flex-col justify-between p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface-container text-secondary">
              <Vote className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-headline text-xl font-semibold text-primary">Live elections</h2>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant">Browse active binary elections, inspect live public results, and cast a signed ballot.</p>
              <button type="button" onClick={() => navigate("/elections")} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-secondary hover:text-primary">
                Open election browser <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </article>

          <article className="flex min-h-64 flex-col justify-between rounded-xl bg-secondary p-6 text-on-secondary">
            <ShieldCheck className="h-7 w-7" aria-hidden="true" />
            <div>
              <h2 className="font-headline text-xl font-semibold">Public by design</h2>
              <p className="mt-2 text-sm leading-6 text-white/80">Your real-world identity is not written to Votex’s public ledger, but your pseudonym, ballot choice, and activity are public and may be linkable.</p>
            </div>
          </article>

          <article className="rounded-xl border border-outline-variant bg-surface-container-high p-7 md:col-span-2">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-xl">
                <p className="civic-label">Local key handling</p>
                <h2 className="mt-2 font-headline text-xl font-semibold text-primary">Your private voting key stays on this device</h2>
                <p className="mt-3 text-sm leading-6 text-on-surface-variant">The browser derives the BabyJubJub key in memory from your passkey. Votex receives signed public data and session bindings, never the private key itself.</p>
              </div>
              <button type="button" onClick={() => navigate("/how-it-works")} className="ledger-button-secondary shrink-0">How It Works</button>
            </div>
          </article>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
