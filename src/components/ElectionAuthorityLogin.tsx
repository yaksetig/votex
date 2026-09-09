import React, { useEffect, useState } from "react";
import { KeyRound, Loader2, Lock, Mail, ShieldCheck, TriangleAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  linkCurrentAuthorityIdentity,
  getFixedAuthorityStatus,
  signInAuthority,
  signUpAuthority,
} from "@/services/electionAuthorityAuthService";

interface ElectionAuthorityLoginProps {
  onLoginSuccess: (authorityId: string, authorityName: string) => void;
}

const ElectionAuthorityLogin: React.FC<ElectionAuthorityLoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [authorityName, setAuthorityName] = useState("");
  const [authoritySecret, setAuthoritySecret] = useState("");
  const [requiresAuthorityLink, setRequiresAuthorityLink] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bootstrapAvailable, setBootstrapAvailable] = useState(false);
  const [checkingAuthority, setCheckingAuthority] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    void getFixedAuthorityStatus().then((status) => {
      if (cancelled) return;
      setBootstrapAvailable(status.configured && !status.linked);
      if (!status.configured) {
        setError("The fixed Election Authority has not been configured yet.");
      }
      setCheckingAuthority(false);
    });
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      if (requiresAuthorityLink) {
        if (!authoritySecret.trim() || !authorityName.trim()) {
          setError("Authority name and secret are required to complete identity linking.");
          return;
        }

        const result = await linkCurrentAuthorityIdentity(authorityName.trim(), authoritySecret.trim());
        if (!result.success || !result.authorityId) {
          setError(result.error ?? "Authority linking failed");
          return;
        }

        setAuthoritySecret("");
        toast({
          title: "Authority linked",
          description: `Secure session established for ${result.authorityName}.`,
        });
        onLoginSuccess(result.authorityId, result.authorityName ?? "Election Authority");
        return;
      }

      if (isSignUp) {
        if (!bootstrapAvailable) {
          setError("The fixed Election Authority is already linked or unavailable.");
          return;
        }
        if (!authoritySecret.trim() || !authorityName.trim()) {
          setError("Authority name and secret are required for registration.");
          return;
        }

        const result = await signUpAuthority(
          email.trim(),
          password,
          authorityName.trim(),
          authoritySecret.trim()
        );

        if (!result.success || !result.authorityId) {
          setError(result.error ?? "Registration failed");
          return;
        }

        setAuthoritySecret("");
        toast({
          title: "Authority account created",
          description: `${result.authorityName} is now registered for secure management access.`,
        });
        onLoginSuccess(result.authorityId, result.authorityName ?? "Election Authority");
        return;
      }

      const result = await signInAuthority(email.trim(), password);

      if (result.requiresAuthorityLink) {
        setRequiresAuthorityLink(true);
        setError(result.error ?? "This account still needs to be linked to an authority identity.");
        return;
      }

      if (!result.success || !result.authorityId) {
        setError(result.error ?? "Sign-in failed");
        return;
      }

      toast({
        title: "Authority authenticated",
        description: `Welcome back, ${result.authorityName}.`,
      });
      onLoginSuccess(result.authorityId, result.authorityName ?? "Election Authority");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Authentication failed";
      setError(message);
      toast({
        variant: "destructive",
        title: "Authentication failed",
        description: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-6">
      <div className="ledger-grid-glow absolute inset-0 opacity-50" />
      <div className="relative z-10 w-full max-w-[480px]">
        <header className="mb-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg bg-primary text-on-primary shadow-sm">
            <ShieldCheck className="h-8 w-8" aria-hidden="true" />
          </div>
          <h1 className="mt-4 font-headline text-3xl font-bold tracking-[-0.03em] text-primary">Votex</h1>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.08em] text-secondary">Election Authority Entrance</p>
        </header>

        <section className="civic-card p-6 sm:p-8">
          <div className="flex items-center gap-3 border-b border-outline-variant pb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container text-secondary">
              <Lock className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="civic-label">Operator only</p>
              <h2 className="mt-1 font-headline text-xl font-semibold text-primary">
                {requiresAuthorityLink ? "Link authority identity" : isSignUp ? "Link fixed authority" : "Sign in to continue"}
              </h2>
            </div>
          </div>

          <p className="mt-5 text-sm leading-6 text-on-surface-variant">
            {requiresAuthorityLink
              ? "This operator account is valid but must still prove ownership of the configured authority key."
              : isSignUp
                ? "Create the one operator account and prove ownership of the configured fixed authority key."
                : "This gateway is for the configured Election Authority operator, not voter accounts."}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <Label htmlFor="email" className="civic-label">Email</Label>
              <div className="relative mt-2">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" aria-hidden="true" />
                <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={isSubmitting} className="pl-10" placeholder="authority@example.com" />
              </div>
            </div>

            <div>
              <Label htmlFor="password" className="civic-label">Password</Label>
              <div className="relative mt-2">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" aria-hidden="true" />
                <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={isSubmitting} className="pl-10" placeholder="Enter your password" />
              </div>
            </div>

            {(isSignUp || requiresAuthorityLink) && (
              <div className="space-y-5 rounded-lg border border-outline-variant bg-surface-container-low p-4">
                <div>
                  <Label htmlFor="authorityName" className="civic-label">Authority name</Label>
                  <Input id="authorityName" value={authorityName} onChange={(event) => setAuthorityName(event.target.value)} disabled={isSubmitting} className="mt-2" placeholder="Votex Election Authority" />
                </div>
                <div>
                  <Label htmlFor="authoritySecret" className="civic-label">Authority secret</Label>
                  <Input id="authoritySecret" type="password" value={authoritySecret} onChange={(event) => setAuthoritySecret(event.target.value)} disabled={isSubmitting} className="mt-2 font-mono" placeholder="votex-auth-v1_… recovery key" />
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-error/20 bg-error-container/60 p-4 text-sm text-on-error-container">
                <div className="flex items-start gap-3">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-error" />
                  <span>{error}</span>
                </div>
              </div>
            )}

            <button type="submit" disabled={isSubmitting || checkingAuthority} className="ledger-button-primary w-full">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {requiresAuthorityLink ? "Link Authority" : isSignUp ? "Register & Link" : "Secure Sign In"}
            </button>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-outline-variant pt-5">
              {bootstrapAvailable || isSignUp || requiresAuthorityLink ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(requiresAuthorityLink ? false : !isSignUp);
                    setRequiresAuthorityLink(false);
                    setError(null);
                  }}
                  className="text-sm font-semibold text-secondary transition-colors hover:text-primary"
                >
                  {isSignUp || requiresAuthorityLink
                    ? "Already have an account? Sign in"
                    : "Bootstrap the fixed authority"}
                </button>
              ) : <span />}

              <a href="mailto:support@votex.world" className="text-sm text-on-surface-variant hover:text-secondary">Support</a>
            </div>

            <div className="rounded-lg bg-surface-container-low p-4 text-sm leading-relaxed text-on-surface-variant">
              <div className="flex items-start gap-3">
                <KeyRound className="mt-0.5 h-4 w-4 text-secondary" />
                <span>
                  Use only the generated 256-bit recovery key. It derives the BabyJubJub key locally and is never stored by the browser or server.
                </span>
              </div>
            </div>
          </form>
        </section>
        <p className="mt-6 text-center font-mono text-xs text-on-surface-variant">Operator actions are authenticated and recorded in the authority audit log.</p>
      </div>
    </div>
  );
};

export default ElectionAuthorityLogin;
