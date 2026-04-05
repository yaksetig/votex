import React, { useState } from "react";
import { KeyRound, Loader2, Lock, Mail, ShieldCheck, TriangleAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  linkCurrentAuthorityIdentity,
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
  const [privateKey, setPrivateKey] = useState("");
  const [requiresAuthorityLink, setRequiresAuthorityLink] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

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
        if (!privateKey.trim() || !authorityName.trim()) {
          setError("Authority name and private key are required to complete identity linking.");
          return;
        }

        const result = await linkCurrentAuthorityIdentity(authorityName.trim(), privateKey.trim());
        if (!result.success || !result.authorityId) {
          setError(result.error ?? "Authority linking failed");
          return;
        }

        setPrivateKey("");
        toast({
          title: "Authority linked",
          description: `Secure session established for ${result.authorityName}.`,
        });
        onLoginSuccess(result.authorityId, result.authorityName ?? "Election Authority");
        return;
      }

      if (isSignUp) {
        if (!privateKey.trim() || !authorityName.trim()) {
          setError("Authority name and private key are required for registration.");
          return;
        }

        const result = await signUpAuthority(
          email.trim(),
          password,
          authorityName.trim(),
          privateKey.trim()
        );

        if (!result.success || !result.authorityId) {
          setError(result.error ?? "Registration failed");
          return;
        }

        setPrivateKey("");
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
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(173,198,255,0.45),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(225,194,155,0.35),transparent_28%),linear-gradient(180deg,#fbfcfd_0%,#f7f9fb_100%)]" />

      <div className="relative z-10 grid w-full max-w-6xl gap-8 lg:grid-cols-[420px_minmax(0,1fr)]">
        <aside className="rounded-[2.25rem] bg-primary-container p-8 text-on-primary shadow-ledger-lg">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-primary-fixed-dim">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <p className="mt-8 ledger-eyebrow text-on-primary-container">Election authority portal</p>
          <h1 className="mt-3 font-headline text-4xl font-extrabold text-white">
            Secure oversight for the Votex vote ledger.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/74">
            Authenticate with your authority account, then prove possession of the BabyJubJub key that governs election updates, tally processing, and audit control.
          </p>

          <div className="mt-10 rounded-[1.5rem] bg-white/10 p-5">
            <p className="ledger-eyebrow text-on-primary-container">Session model</p>
            <ul className="mt-4 space-y-3 text-sm text-white/78">
              <li>JWT-backed authority sessions</li>
              <li>Server-verified key ownership proofs</li>
              <li>Audit-linked management actions</li>
            </ul>
          </div>
        </aside>

        <section className="rounded-[2.25rem] border border-outline-variant/12 bg-surface-container-lowest p-8 shadow-ledger sm:p-10">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-on-primary">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <p className="ledger-eyebrow">Authority authentication</p>
              <h2 className="mt-1 font-headline text-3xl font-extrabold text-primary">
                {requiresAuthorityLink
                  ? "Link authority identity"
                  : isSignUp
                    ? "Register authority account"
                    : "Sign in to continue"}
              </h2>
            </div>
          </div>

          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-on-surface-variant">
            {requiresAuthorityLink
              ? "This Supabase Auth account is valid, but still needs to be bound to an authority key before it can manage elections."
              : isSignUp
                ? "Create an authority account and bind it to the BabyJubJub key that controls your election records."
                : "Use your authority email and password to access the election administration surface."}
          </p>

          <form onSubmit={handleSubmit} className="mt-10 space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <Label htmlFor="email" className="ledger-eyebrow">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={isSubmitting}
                  className="mt-3"
                  placeholder="authority@example.com"
                />
              </div>

              <div>
                <Label htmlFor="password" className="ledger-eyebrow">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={isSubmitting}
                  className="mt-3"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            {(isSignUp || requiresAuthorityLink) && (
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <Label htmlFor="authorityName" className="ledger-eyebrow">
                    Authority name
                  </Label>
                  <Input
                    id="authorityName"
                    value={authorityName}
                    onChange={(event) => setAuthorityName(event.target.value)}
                    disabled={isSubmitting}
                    className="mt-3"
                    placeholder="Default Election Authority"
                  />
                </div>

                <div>
                  <Label htmlFor="privateKey" className="ledger-eyebrow">
                    BabyJubJub private key
                  </Label>
                  <Input
                    id="privateKey"
                    type="password"
                    value={privateKey}
                    onChange={(event) => setPrivateKey(event.target.value)}
                    disabled={isSubmitting}
                    className="mt-3"
                    placeholder="Used once to prove authority key ownership"
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-[1.25rem] border border-error/20 bg-error-container/60 p-4 text-sm text-on-error-container">
                <div className="flex items-start gap-3">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-error" />
                  <span>{error}</span>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-outline-variant/15 pt-6">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(requiresAuthorityLink ? false : !isSignUp);
                  setRequiresAuthorityLink(false);
                  setError(null);
                }}
                className="text-sm font-semibold text-surface-tint transition-colors hover:text-primary"
              >
                {isSignUp || requiresAuthorityLink
                  ? "Already have an account? Sign in"
                  : "Need an authority account? Register"}
              </button>

              <button type="submit" disabled={isSubmitting} className="ledger-button-primary">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {requiresAuthorityLink
                  ? "Link Authority"
                  : isSignUp
                    ? "Register & Link"
                    : "Secure Sign In"}
              </button>
            </div>

            <div className="rounded-[1.25rem] bg-surface-container-low p-4 text-sm leading-relaxed text-on-surface-variant">
              <div className="flex items-start gap-3">
                <KeyRound className="mt-0.5 h-4 w-4 text-surface-tint" />
                <span>
                  Authority private keys are used only to derive the public key and sign a one-time ownership proof. They are never stored by the browser or server.
                </span>
              </div>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};

export default ElectionAuthorityLogin;
