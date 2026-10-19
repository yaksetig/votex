import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Copy,
  Fingerprint,
  KeyRound,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Vote,
} from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { useDeriveKeypair } from "@/hooks/useDeriveKeypair";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/usePageTitle";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { abbreviateIdentifier } from "@/lib/format";
import { ROUTES, howItWorksSection } from "@/lib/routes";
import { PageHeader } from "@/components/PageHeader";

/**
 * The signed-in voter's profile: their pseudonym (how they appear in public
 * records), the state of their voting key, and sign-out. Sign-in lives on
 * its own page (/sign-in); ProtectedRoute guarantees a session here.
 */
const Profile = () => {
  usePageTitle("Your profile");
  const { derivedPublicKey, userId, resetIdentity } = useWallet();
  const { deriveKeypair, isDeriving: isDerivingKey } = useDeriveKeypair();
  const { toast } = useToast();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const copyValue = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ key: "clipboard", title: `${label} copied` });
    } catch {
      toast({ key: "clipboard", variant: "destructive", title: "Copy failed", description: "Your browser did not allow clipboard access." });
    }
  };

  const pseudonym = userId ?? "";

  return (
    <div className="civic-container pb-12 pt-10">
      <PageHeader
        eyebrow="Your profile"
        title="Your voting identity"
        description="World ID has confirmed you are a unique person. Your passkey derives your voting key in this browser whenever a vote needs signing."
        actions={
          <Link to={ROUTES.elections} className="ledger-button-primary">
            Browse elections <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        }
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-12">
        <aside className="space-y-6 lg:col-span-5">
          <section className="ledger-panel p-6" aria-labelledby="pseudonym-heading">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-secondary bg-surface-container text-secondary">
                <ShieldCheck className="h-7 w-7" aria-hidden="true" />
              </div>
              <div>
                <h2 id="pseudonym-heading" className="font-headline text-xl font-semibold text-primary">Signed in</h2>
                <p className="mt-1 text-sm text-on-surface-variant">Verified with World ID</p>
              </div>
            </div>

            <div className="mt-6 border-t border-outline-variant pt-5">
              <p className="ledger-eyebrow">Your pseudonym</p>
              <p className="mt-1 text-sm text-on-surface-variant">
                This is how you appear in every public record: ballots, participants, delegations and tallies.
              </p>
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-surface-container-low p-3">
                <code className="civic-mono min-w-0 flex-1 break-all text-primary" title={pseudonym}>
                  {abbreviateIdentifier(pseudonym, 10)}
                </code>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Copy pseudonym"
                  onClick={() => void copyValue("Pseudonym", pseudonym)}
                >
                  <Copy className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>

            <dl className="mt-6 space-y-4 border-t border-outline-variant pt-5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-2 text-on-surface-variant">
                  <CheckCircle2 className="h-4 w-4 text-secondary" aria-hidden="true" /> World ID
                </dt>
                <dd className="font-semibold text-primary">Verified</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-2 text-on-surface-variant">
                  <KeyRound className="h-4 w-4 text-secondary" aria-hidden="true" /> Voting key in this tab
                </dt>
                <dd className="font-semibold text-primary">{derivedPublicKey ? "Unlocked" : "Locked"}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-xl bg-primary p-6 text-on-primary" aria-labelledby="key-heading">
            <p id="key-heading" className="ledger-eyebrow text-secondary-fixed">Voting key</p>
            {derivedPublicKey ? (
              <div className="mt-5 space-y-4">
                <p className="text-sm leading-6 text-white/80">
                  The public half of your voting key. Delegates can use it to confirm who you are.
                </p>
                {(["x", "y"] as const).map((coordinate) => (
                  <div key={coordinate}>
                    <p className="text-xs font-semibold uppercase tracking-eyebrow text-white/70">Public key {coordinate.toUpperCase()}</p>
                    <div className="mt-2 flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 p-3">
                      <code className="civic-mono min-w-0 flex-1 truncate text-white" title={derivedPublicKey[coordinate]}>
                        {derivedPublicKey[coordinate]}
                      </code>
                      <button
                        type="button"
                        aria-label={`Copy public key ${coordinate.toUpperCase()}`}
                        onClick={() => void copyValue(`Public key ${coordinate.toUpperCase()}`, derivedPublicKey[coordinate])}
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-fixed"
                      >
                        <Copy className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-white/80">
                Your voting key is locked in this tab. Unlock your passkey to derive it; it is never sent to Votex.
              </p>
            )}
          </section>

          <button
            type="button"
            onClick={() => {
              if (!isDerivingKey) void deriveKeypair();
            }}
            aria-busy={isDerivingKey || undefined}
            aria-disabled={isDerivingKey || undefined}
            className="ledger-button-secondary w-full"
          >
            {isDerivingKey ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : derivedPublicKey ? (
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Fingerprint className="h-4 w-4" aria-hidden="true" />
            )}
            {isDerivingKey ? "Waiting for your passkey…" : derivedPublicKey ? "Unlock again" : "Unlock passkey"}
          </button>
        </aside>

        <section className="grid content-start gap-6 md:grid-cols-2 lg:col-span-7">
          <article className="ledger-panel flex min-h-56 flex-col justify-between p-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface-container text-secondary">
              <Vote className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-headline text-xl font-semibold text-primary">Open elections</h2>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant">Browse elections, read the public results and cast a signed ballot.</p>
              <Link to={ROUTES.elections} className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-secondary hover:text-primary">
                Open elections <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </article>

          <article className="flex min-h-56 flex-col justify-between rounded-xl bg-secondary p-6 text-on-secondary">
            <ShieldCheck className="h-7 w-7" aria-hidden="true" />
            <div>
              <h2 className="font-headline text-xl font-semibold">Public by design</h2>
              <p className="mt-2 text-sm leading-6 text-white/85">
                Your real-world identity is never written to Votex. Your pseudonym, your ballot choices and your activity are
                public and may be linkable across elections.
              </p>
              <Link to={howItWorksSection("privacy")} className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-white underline-offset-4 hover:underline">
                Read the privacy model <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </article>

          <article className="rounded-xl border border-outline-variant bg-surface-container-high p-7 md:col-span-2">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-xl">
                <p className="ledger-eyebrow">Your voting key</p>
                <h2 className="mt-2 font-headline text-xl font-semibold text-primary">Derived in this browser, never sent to Votex</h2>
                <p className="mt-3 text-sm leading-6 text-on-surface-variant">
                  Your passkey derives the voting key on this device. Votex only receives signed public data and the session
                  binding needed to recognise the same person later.
                </p>
              </div>
              <Link to={ROUTES.howItWorks} className="ledger-button-secondary shrink-0">How Votex works</Link>
            </div>
          </article>

          <article className="ledger-panel p-6 md:col-span-2">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-headline text-xl font-semibold text-primary">Sign out</h2>
                <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                  Ends your session on this device and clears the voting key from this tab. Your ballots stay in the public record.
                </p>
              </div>
              <Button type="button" variant="outline" onClick={() => setConfirmSignOut(true)}>
                <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
              </Button>
            </div>
          </article>
        </section>
      </div>

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
          }
        }}
      />
    </div>
  );
};

export default Profile;
