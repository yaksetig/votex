import React, { Suspense, lazy, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Fingerprint,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/hooks/use-toast";

const WorldIDSignIn = lazy(() => import("@/components/WorldIDSignIn"));

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    derivedPublicKey,
    isWorldIDVerified,
    setDerivedPublicKey,
    userId,
  } = useWallet();
  const [isDerivingKey, setIsDerivingKey] = useState(false);

  const rederiveKeypair = async () => {
    setIsDerivingKey(true);

    try {
      const [
        { authenticateWithPreferredPasskey },
        { deriveKeypairFromSecret, publicKeyToStrings, verifyDerivedKeypair },
      ] = await Promise.all([
        import("@/services/passkeyService"),
        import("@/services/deterministicKeyService"),
      ]);

      const prfResult = await authenticateWithPreferredPasskey();
      const keypair = await deriveKeypairFromSecret(prfResult.secret);

      if (!verifyDerivedKeypair(keypair)) {
        throw new Error("Derived keypair verification failed");
      }

      const publicKey = publicKeyToStrings(keypair.pk);
      setDerivedPublicKey(publicKey);

      toast({
        title: "Passkey unlocked",
        description: "Your cryptographic keypair has been re-derived locally.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Derivation failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to derive your cryptographic keypair",
      });
    } finally {
      setIsDerivingKey(false);
    }
  };

  if (!isWorldIDVerified || !userId) {
    return (
      <Suspense fallback={<div className="flex min-h-[calc(100vh-72px)] items-center justify-center px-4 py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
        <WorldIDSignIn />
      </Suspense>
    );
  }

  return (
    <div className="px-4 pb-24 pt-10 sm:px-6 md:pb-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="ledger-panel relative overflow-hidden p-8 md:p-12">
          <div className="absolute -left-8 top-0 h-64 w-64 rounded-full bg-primary-fixed-dim/55 blur-[100px]" />
          <div className="absolute -bottom-16 right-0 h-64 w-64 rounded-full bg-secondary-fixed/70 blur-[120px]" />

          <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <span className="ledger-badge bg-secondary-container text-on-secondary-container">
                <ShieldCheck className="h-4 w-4" />
                Identity vault
              </span>
              <h1 className="mt-5 font-headline text-4xl font-extrabold tracking-tight text-primary md:text-6xl">
                Your Secure Voting Identity
              </h1>
              <p className="mt-4 text-lg leading-relaxed text-on-surface-variant">
                World ID is verified. Your private voting key is derived from your passkey only when you need it, then released after the signing workflow completes.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={rederiveKeypair}
                disabled={isDerivingKey}
                className="ledger-button-secondary"
              >
                {isDerivingKey ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Re-derive Key
              </button>
              <button
                type="button"
                onClick={() => navigate("/elections")}
                className="ledger-button-primary"
              >
                Browse Elections
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <div className="ledger-panel p-6">
            <ShieldCheck className="h-6 w-6 text-surface-tint" />
            <div className="mt-5 font-headline text-4xl font-extrabold text-surface-tint">
              Active
            </div>
            <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
              World ID status
            </p>
          </div>

          <div className="ledger-panel p-6">
            <Fingerprint className="h-6 w-6 text-primary" />
            <div className="mt-5 font-headline text-4xl font-extrabold text-primary">
              Passkey
            </div>
            <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
              Biometric unlock
            </p>
          </div>

          <div className="ledger-panel p-6">
            <KeyRound className="h-6 w-6 text-tertiary-container" />
            <div className="mt-5 font-headline text-4xl font-extrabold text-tertiary-container">
              {derivedPublicKey ? "Ready" : "Locked"}
            </div>
            <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
              Signing key
            </p>
          </div>

          <div className="ledger-panel p-6">
            <ShieldCheck className="h-6 w-6 text-secondary" />
            <div className="mt-5 font-headline text-4xl font-extrabold text-secondary">
              Private
            </div>
            <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
              Local derivation
            </p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_360px]">
          <div className="ledger-panel p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <p className="ledger-eyebrow">Cryptographic key material</p>
                <h2 className="mt-1 font-headline text-3xl font-extrabold text-primary">
                  Public key details
                </h2>
              </div>
            </div>

            {derivedPublicKey ? (
              <div className="mt-8 space-y-5">
                <div className="rounded-[1.5rem] border border-outline-variant/12 bg-surface-container-low p-5">
                  <p className="ledger-eyebrow">Public Key X</p>
                  <code className="mt-3 block break-all text-sm font-semibold text-primary">
                    {derivedPublicKey.x}
                  </code>
                </div>
                <div className="rounded-[1.5rem] border border-outline-variant/12 bg-surface-container-low p-5">
                  <p className="ledger-eyebrow">Public Key Y</p>
                  <code className="mt-3 block break-all text-sm font-semibold text-primary">
                    {derivedPublicKey.y}
                  </code>
                </div>
              </div>
            ) : (
              <div className="mt-8 rounded-[1.5rem] border border-outline-variant/12 bg-surface-container-low p-6">
                <h3 className="font-headline text-2xl font-bold text-primary">
                  Derive your keypair before voting
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
                  Select your passkey from the browser prompt to reconstruct the BabyJubJub keypair used for vote signing and nullification.
                </p>
                <button
                  type="button"
                  onClick={rederiveKeypair}
                  disabled={isDerivingKey}
                  className="ledger-button-primary mt-6"
                >
                  {isDerivingKey ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Fingerprint className="h-4 w-4" />
                  )}
                  Unlock with Passkey
                </button>
              </div>
            )}
          </div>

          <aside className="space-y-6">
            <div className="rounded-[2rem] bg-primary-container p-7 text-on-primary shadow-ledger-lg">
              <p className="ledger-eyebrow text-on-primary-container">Integrity note</p>
              <h3 className="mt-3 font-headline text-2xl font-bold text-white">
                The private key never leaves your device
              </h3>
              <p className="mt-4 text-sm leading-relaxed text-white/76">
                The browser uses your passkey-derived secret only to reconstruct the signing key in memory. The server sees proof bindings and sessions, not the private key itself.
              </p>
            </div>

            <div className="ledger-panel p-6">
              <p className="ledger-eyebrow">Next action</p>
              <h3 className="mt-3 font-headline text-2xl font-bold text-primary">
                Continue to the election browser
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
                Browse active ballots, inspect the audit protocol, and submit a vote when your passkey-derived key is ready.
              </p>
              <button
                type="button"
                onClick={() => navigate("/elections")}
                className="ledger-button-primary mt-6"
              >
                Open Elections
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
