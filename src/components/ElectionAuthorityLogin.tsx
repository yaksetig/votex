import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, KeyRound, Loader2, Lock, Mail, ShieldCheck, TriangleAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
  linkCurrentAuthorityIdentity,
  getFixedAuthorityStatus,
  signInAuthority,
  signUpAuthority,
} from "@/services/electionAuthorityAuthService";
import { describeError } from "@/lib/errorMessages";
import { ROUTES } from "@/lib/routes";

interface ElectionAuthorityLoginProps {
  onLoginSuccess: (authorityId: string, authorityName: string) => void;
}

/** Password-style input with a show/hide toggle; a 64-hex key typed blind is a typo waiting to happen. */
function SecretInput({
  id,
  value,
  onChange,
  disabled,
  autoComplete,
  placeholder,
  mono = false,
  invalid,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoComplete: string;
  placeholder?: string;
  mono?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        autoComplete={autoComplete}
        spellCheck={false}
        placeholder={placeholder}
        className={mono ? "pr-12 font-mono" : "pr-12"}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Hide" : "Show"}
        aria-pressed={visible}
        className="absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container-low hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
      >
        {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
      </button>
    </div>
  );
}

const ElectionAuthorityLogin: React.FC<ElectionAuthorityLoginProps> = ({ onLoginSuccess }) => {
  usePageTitle("Election Authority sign-in");
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

  useEffect(() => {
    let cancelled = false;
    void getFixedAuthorityStatus().then((status) => {
      if (cancelled) return;
      setBootstrapAvailable(status.configured && !status.linked);
      if (!status.configured) {
        setError("The Election Authority has not been configured for this deployment yet, so nobody can sign in here.");
      }
      setCheckingAuthority(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const needsKey = isSignUp || requiresAuthorityLink;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Enter your email and password.");
      return;
    }
    try {
      setIsSubmitting(true);
      setError(null);

      if (requiresAuthorityLink) {
        if (!authoritySecret.trim() || !authorityName.trim()) {
          setError("Enter the authority name and the recovery key to finish linking.");
          return;
        }
        const result = await linkCurrentAuthorityIdentity(authorityName.trim(), authoritySecret.trim());
        if (!result.success || !result.authorityId) {
          setError(result.error ?? "The authority could not be linked.");
          return;
        }
        setAuthoritySecret("");
        onLoginSuccess(result.authorityId, result.authorityName ?? "Election Authority");
        return;
      }

      if (isSignUp) {
        if (!bootstrapAvailable) {
          setError("The Election Authority is already linked to an account. Sign in instead.");
          return;
        }
        if (!authoritySecret.trim() || !authorityName.trim()) {
          setError("Enter the authority name and the recovery key to register.");
          return;
        }
        const result = await signUpAuthority(email.trim(), password, authorityName.trim(), authoritySecret.trim());
        if (!result.success || !result.authorityId) {
          setError(result.error ?? "Registration did not complete.");
          return;
        }
        setAuthoritySecret("");
        onLoginSuccess(result.authorityId, result.authorityName ?? "Election Authority");
        return;
      }

      const result = await signInAuthority(email.trim(), password);
      if (result.requiresAuthorityLink) {
        setRequiresAuthorityLink(true);
        setError("This account is not linked to the Election Authority yet. Enter the recovery key to link it.");
        return;
      }
      if (!result.success || !result.authorityId) {
        setError(result.error ?? "Sign-in did not complete. Check your email and password.");
        return;
      }
      onLoginSuccess(result.authorityId, result.authorityName ?? "Election Authority");
    } catch (err) {
      setError(describeError(err, "Sign-in did not complete. Try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-6">
      <div className="ledger-grid-glow absolute inset-0 opacity-50" aria-hidden="true" />
      <div className="relative z-10 w-full max-w-[480px]">
        <Link to={ROUTES.home} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-on-surface-variant hover:text-primary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Votex
        </Link>
        <header className="mb-8 mt-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg bg-primary text-on-primary shadow-sm">
            <ShieldCheck className="h-8 w-8" aria-hidden="true" />
          </div>
          <h1 className="mt-4 font-headline text-3xl font-bold tracking-[-0.03em] text-primary">Election Authority</h1>
          <p className="mt-2 text-sm text-on-surface-variant">Operator sign-in for the Votex Election Authority console.</p>
        </header>

        <section className="ledger-panel p-6 sm:p-8" aria-labelledby="authority-login-title">
          <div className="flex items-center gap-3 border-b border-outline-variant pb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container text-secondary">
              <Lock className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="ledger-eyebrow">Operators only</p>
              <h2 id="authority-login-title" className="mt-1 font-headline text-xl font-semibold text-primary">
                {requiresAuthorityLink ? "Link authority identity" : isSignUp ? "Set up the Election Authority" : "Sign in to continue"}
              </h2>
            </div>
          </div>

          <p className="mt-5 text-sm leading-6 text-on-surface-variant">
            {requiresAuthorityLink
              ? "Your account is valid. To finish, prove you hold the Election Authority's recovery key."
              : isSignUp
                ? "Create the single operator account and prove you hold the Election Authority's recovery key."
                : "This is not the voter sign-in. Voters sign in with World ID from the Votex home page."}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
            <div>
              <Label htmlFor="email" className="ledger-eyebrow">
                Email
              </Label>
              <div className="relative mt-2">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" aria-hidden="true" />
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={isSubmitting}
                  className="pl-10"
                  placeholder="operator@example.org"
                  aria-invalid={error && !email.trim() ? true : undefined}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password" className="ledger-eyebrow">
                Password
              </Label>
              <div className="mt-2">
                <SecretInput
                  id="password"
                  value={password}
                  onChange={setPassword}
                  disabled={isSubmitting}
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  placeholder="Your password"
                  invalid={Boolean(error) && !password.trim()}
                />
              </div>
            </div>

            {needsKey && (
              <div className="space-y-5 rounded-lg border border-outline-variant bg-surface-container-low p-4">
                <div>
                  <Label htmlFor="authorityName" className="ledger-eyebrow">
                    Authority name
                  </Label>
                  <Input
                    id="authorityName"
                    value={authorityName}
                    onChange={(event) => setAuthorityName(event.target.value)}
                    disabled={isSubmitting}
                    autoComplete="organization"
                    className="mt-2"
                    placeholder="Votex Election Authority"
                  />
                </div>
                <div>
                  <Label htmlFor="authoritySecret" className="ledger-eyebrow">
                    Authority secret
                  </Label>
                  <div className="mt-2">
                    <SecretInput
                      id="authoritySecret"
                      value={authoritySecret}
                      onChange={setAuthoritySecret}
                      disabled={isSubmitting}
                      autoComplete="off"
                      placeholder="votex-auth-v1_…"
                      mono
                      describedBy="authoritySecret-hint"
                    />
                  </div>
                  <p id="authoritySecret-hint" className="mt-2 flex items-start gap-2 text-xs leading-relaxed text-on-surface-variant">
                    <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    The recovery key generated when the authority was set up. It is used in this browser only to prove
                    ownership and is never stored.
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div role="alert" className="rounded-lg border border-error/20 bg-error-container p-4 text-sm text-on-error-container">
                <div className="flex items-start gap-3">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-error" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              </div>
            )}

            <Button type="submit" className="w-full" size="lg" busy={isSubmitting} aria-disabled={checkingAuthority || undefined}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="h-4 w-4" aria-hidden="true" />}
              {requiresAuthorityLink ? "Link authority" : isSignUp ? "Register and link" : "Sign in"}
            </Button>

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-outline-variant pt-5">
              {bootstrapAvailable || isSignUp || requiresAuthorityLink ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(requiresAuthorityLink ? false : !isSignUp);
                    setRequiresAuthorityLink(false);
                    setError(null);
                  }}
                  className="min-h-11 text-sm font-semibold text-secondary transition-colors hover:text-primary"
                >
                  {isSignUp || requiresAuthorityLink ? "Already have an account? Sign in" : "Set up the Election Authority for the first time"}
                </button>
              ) : (
                <span />
              )}
              <a href="mailto:support@votex.world" className="inline-flex min-h-11 items-center text-sm text-on-surface-variant hover:text-secondary">
                Support
              </a>
            </div>
          </form>
        </section>
        <p className="mt-6 text-center text-xs text-on-surface-variant">Every operator action is recorded in the authority audit log.</p>
      </div>
    </div>
  );
};

export default ElectionAuthorityLogin;
