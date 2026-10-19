import React, { useState, useEffect, useCallback } from "react";
import {
  IDKitRequestWidget,
  orbLegacy,
  type IDKitResult,
  type RpContext,
} from "@worldcoin/idkit";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ROUTES, safeNextPath } from "@/lib/routes";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Fingerprint,
  HelpCircle,
  KeyRound,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  authenticateWithPasskeyPicker,
  createPasskeyCredential,
  deriveSecretFromPasskey,
} from "@/services/passkeyService";
import {
  deriveKeypairFromSecret,
  hashPublicKeyForSignal,
  publicKeyToStrings,
  verifyDerivedKeypair,
} from "@/services/deterministicKeyService";
import {
  createWorldIdSession,
  deriveSessionVerifierHash,
} from "@/services/worldIdSessionService";
import { logger } from "@/services/logger";
import { createRegistrationOwnershipProof } from "@/services/registrationOwnershipProofService";
import { WORLD_ID_DEFAULT_RP_ID, WORLD_ID_REGISTRATION_ACTION } from "@protocol";
import { readFunctionError, VotexApiError } from "@/types/api";
import { describeError, describeWorldIdError } from "@/lib/errorMessages";
import { cn } from "@/lib/utils";

type SignInStep =
  | "ready"
  | "preparing-passkey"
  | "awaiting-worldid"
  | "registering"
  | "complete"
  | "error";

// The passkey-derived material the World ID proof must commit to. The keypair
// is derived first so its public key can be folded into the proof's signal —
// register-keypair rejects proofs whose signal_hash != Hash(pk).
interface PreparedPasskey {
  prfSecret: ArrayBuffer;
  publicKey: { x: string; y: string };
  signal: string;
  verifierHash: string;
}

const WORLD_ID_APP_ID = "app_e2fd2f8c99430ab200a093278e801c57";
const WORLD_ID_RP_ID = import.meta.env.VITE_WORLD_ID_RP_ID ?? WORLD_ID_DEFAULT_RP_ID;
const WORLD_ID_ACTION = WORLD_ID_REGISTRATION_ACTION;
const SUPPORT_EMAIL = "support@votex.world";

type PasskeyPreparationMode = "existing" | "new";

/** A non-interactive progress or result row; replaces the old disabled buttons. */
const StatusRow = ({
  tone,
  icon,
  children,
}: {
  tone: "busy" | "done";
  icon: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div
    role="status"
    aria-live="polite"
    className={cn(
      "flex min-h-12 w-full items-center justify-center gap-3 rounded-xl px-6 py-3 text-base font-semibold",
      tone === "busy" ? "bg-surface-container-low text-primary" : "bg-primary-fixed text-primary"
    )}
  >
    {icon}
    {children}
  </div>
);

const WorldIDSignIn: React.FC = () => {
  const [step, setStep] = useState<SignInStep>("ready");
  const [error, setError] = useState<string | null>(null);
  const [preparedPasskey, setPreparedPasskey] = useState<PreparedPasskey | null>(null);
  const [hasKeyConflict, setHasKeyConflict] = useState(false);
  const [widgetOpen, setWidgetOpen] = useState(false);
  const [rpContext, setRpContext] = useState<RpContext | null>(null);
  const [rpState, setRpState] = useState<"loading" | "ready" | "failed">("loading");
  const [returningIdentity, setReturningIdentity] = useState(false);
  const { setDerivedPublicKey, setIsWorldIDVerified, setUserId } = useWallet();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"), ROUTES.elections);

  // World ID needs a server-signed relying-party context. Without it step 2
  // cannot start, so a failure is shown with a retry rather than logged only.
  const fetchRpSignature = useCallback(async () => {
    setRpState("loading");
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("rp-signature", {
        body: { action: WORLD_ID_ACTION },
      });
      if (invokeError || !data) {
        logger.error("Failed to fetch RP signature", invokeError);
        setRpState("failed");
        return;
      }
      setRpContext({
        rp_id: WORLD_ID_RP_ID,
        nonce: data.nonce,
        created_at: data.created_at,
        expires_at: data.expires_at,
        signature: data.sig,
      });
      setRpState("ready");
    } catch (err) {
      logger.error("Error fetching RP signature", err);
      setRpState("failed");
    }
  }, []);

  useEffect(() => {
    void fetchRpSignature();
  }, [fetchRpSignature]);

  const completeSession = async (
    nullifierHash: string,
    prfSecret: ArrayBuffer,
    publicKey?: { x: string; y: string }
  ) => {
    const session = await createWorldIdSession(nullifierHash, prfSecret);
    setUserId(session.userId);
    setIsWorldIDVerified(true);
    if (publicKey) {
      setDerivedPublicKey(publicKey);
    }
  };

  /** The RP-scoped nullifier of the single v4 response register-keypair accepts. */
  const getNullifier = (result: IDKitResult): string => {
    const record = result as unknown as Record<string, unknown>;
    const responses = record.responses as Array<{ nullifier?: string }> | undefined;
    if (responses?.[0]?.nullifier) {
      return responses[0].nullifier;
    }
    throw new VotexApiError("VALIDATION_ERROR", "World ID returned no nullifier");
  };

  // Step 1: derive the passkey-backed keypair so we know the public key that
  // the World ID proof must be bound to. The signal (= Hash(pk)) is then folded
  // into the proof request, which is why the passkey must come before World ID.
  const preparePasskey = async (mode: PasskeyPreparationMode) => {
    setStep("preparing-passkey");
    setError(null);
    setHasKeyConflict(false);
    setPreparedPasskey(null);
    setWidgetOpen(false);

    try {
      let prfResult;

      if (mode === "new") {
        const userIdBytes = crypto.getRandomValues(new Uint8Array(32));
        const credentialId = await createPasskeyCredential(userIdBytes);
        prfResult = await deriveSecretFromPasskey(credentialId);
      } else {
        // Always show the discoverable credential picker during sign-in. The
        // old create-first flow may have cached a newly-created credential ID;
        // using it automatically would repeat the key-binding conflict instead
        // of letting the voter select their original Votex passkey.
        prfResult = await authenticateWithPasskeyPicker();
      }

      const keypair = await deriveKeypairFromSecret(prfResult.secret);
      if (!verifyDerivedKeypair(keypair)) {
        throw new Error("Derived keypair failed validation");
      }

      const publicKey = publicKeyToStrings(keypair.pk);
      const signal = await hashPublicKeyForSignal(keypair.pk);
      const verifierHash = await deriveSessionVerifierHash(prfResult.secret);

      setPreparedPasskey({ prfSecret: prfResult.secret, publicKey, signal, verifierHash });
      setStep("awaiting-worldid");
      setWidgetOpen(true);
    } catch (err) {
      logger.error("Passkey preparation failed", err);
      setError(
        describeError(
          err,
          mode === "new"
            ? "Your passkey could not be created. Try again, or use a different browser or device."
            : "Your passkey could not be read. Try again and pick the passkey you created for Votex."
        )
      );
      setStep("error");
    }
  };

  /** Called by IDKitRequestWidget to verify the proof on our backend */
  const handleVerify = async (result: IDKitResult) => {
    // This is called before onSuccess — if it throws, onSuccess won't fire.
    // Full verification happens during registration; only the shape is checked here.
    const responses = (result as unknown as Record<string, unknown>).responses as Array<{ nullifier?: string }> | undefined;
    if (!responses?.[0]?.nullifier) {
      throw new Error("Invalid IDKit result: missing nullifier");
    }
  };

  // Step 2: the World ID proof is now signal-bound to the prepared keypair, so
  // register-keypair accepts it. The server is the source of truth for whether
  // this is a new registration or a returning identity (alreadyExists).
  const handleWorldIDSuccess = async (result: IDKitResult) => {
    if (!preparedPasskey) {
      setError("Your passkey step did not finish. Start again from step 1.");
      setStep("error");
      return;
    }

    setStep("registering");
    setError(null);

    try {
      const { prfSecret, publicKey, signal, verifierHash } = preparedPasskey;

      // Prove possession of the passkey-derived private key for this exact
      // nullifier; register-keypair refuses bindings without it.
      const ownershipProof = await createRegistrationOwnershipProof(prfSecret, getNullifier(result), publicKey);

      // verifierHash is registered here, under the verified World ID proof;
      // worldid-session refuses to issue sessions for identities without one.
      const { data, error: registerError } = await supabase.functions.invoke("register-keypair", {
        body: { pk: publicKey, signal, idkitResult: result, verifierHash, ownershipProof },
      });

      if (registerError) {
        throw await readFunctionError(registerError, "CONFLICT", "Failed to bind World ID to the selected passkey");
      }
      if (data?.error) {
        throw new VotexApiError(data.code ?? "CONFLICT", String(data.error));
      }

      const nullifier = getNullifier(result);
      await completeSession(nullifier, prfSecret, publicKey);
      // The confirmation step below owns the next move; no timer, no toast.
      setReturningIdentity(data?.alreadyExists === true);
      setStep("complete");
    } catch (err) {
      logger.error("Registration failed", err);
      if (err instanceof VotexApiError && err.code === "KEYPAIR_ALREADY_BOUND") {
        setPreparedPasskey(null);
        setWidgetOpen(false);
        setHasKeyConflict(true);
        setError(null);
        setStep("error");
        return;
      }
      setError(describeError(err, "Your identity could not be registered. Try again in a moment."));
      setStep("error");
    }
  };

  const handleWorldIDError = (errorCode: unknown) => {
    const code = typeof errorCode === "string" ? errorCode : undefined;
    logger.error("World ID verification failed", errorCode);
    setError(describeWorldIdError(code));
    setStep("error");
  };

  const showPasskeyActions = step === "ready" || (step === "error" && !preparedPasskey);
  const stepTwoEnabled =
    step === "awaiting-worldid" ||
    step === "registering" ||
    step === "complete" ||
    (step === "error" && !!preparedPasskey);
  const supportHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Votex sign-in: passkey already linked")}`;

  return (
    <div className="relative flex min-h-[calc(100vh-64px)] items-center justify-center overflow-hidden px-4 py-10 sm:px-6">
      <div className="absolute inset-0 ledger-grid-glow opacity-60" aria-hidden="true" />

      <div className="relative z-10 w-full max-w-5xl">
        <div className="text-center">
          <p className="ledger-eyebrow text-secondary">Sign in</p>
          <h1 className="mt-3 font-headline text-3xl font-bold tracking-display text-primary sm:text-4xl">
            Sign in to Votex
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-on-surface-variant">
            Two steps: unlock your Votex passkey, then confirm with World ID that you are a unique person.
          </p>
        </div>

        <div className="mx-auto mt-8 max-w-2xl space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              <AlertTitle>Something went wrong</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {hasKeyConflict && (
            <Alert>
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              <AlertTitle>This World ID is already linked to a different passkey</AlertTitle>
              <AlertDescription>
                <p>
                  Choose the passkey you originally created for Votex. A newly created passkey produces a different
                  voting key, so it cannot be linked to the same World ID.
                </p>
                <p className="mt-2">
                  Lost the original passkey?{" "}
                  <a href={supportHref} className="font-semibold text-secondary underline-offset-4 hover:underline">
                    Contact support
                  </a>{" "}
                  and mention the code <code className="civic-mono">KEYPAIR_ALREADY_BOUND</code>.
                </p>
              </AlertDescription>
            </Alert>
          )}

          <section className="ledger-panel relative overflow-hidden p-5 sm:p-8" aria-labelledby="step-1-title">
            <div className="pointer-events-none absolute -right-4 -top-4 hidden opacity-[0.05] lg:block" aria-hidden="true">
              <Fingerprint className="h-32 w-32" aria-hidden="true" />
            </div>

            <div className="relative z-10 lg:pr-24">
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-on-primary" aria-hidden="true">
                  1
                </div>
                <div>
                  <h2 id="step-1-title" className="font-headline text-xl font-semibold text-primary">
                    Unlock your Votex passkey
                  </h2>
                  <p className="text-sm text-on-surface-variant">
                    Use the same passkey you created when you first joined.
                  </p>
                </div>
              </div>

              {showPasskeyActions ? (
                <div className="space-y-3">
                  <Button onClick={() => preparePasskey("existing")} size="lg" className="w-full justify-center text-base">
                    <KeyRound className="h-5 w-5" aria-hidden="true" />
                    {hasKeyConflict ? "Choose your original Votex passkey" : "Continue with passkey"}
                  </Button>

                  {!hasKeyConflict && (
                    <div className="text-center">
                      <Button
                        type="button"
                        variant="link"
                        onClick={() => preparePasskey("new")}
                        className="text-sm font-semibold text-secondary"
                      >
                        <Fingerprint className="h-4 w-4" aria-hidden="true" />
                        I don&apos;t have a Votex passkey yet
                      </Button>
                      <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
                        Only create one if you have never joined Votex. A new passkey creates a new voting identity.
                      </p>
                    </div>
                  )}
                </div>
              ) : step === "preparing-passkey" ? (
                <StatusRow tone="busy" icon={<Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}>
                  Waiting for your passkey…
                </StatusRow>
              ) : (
                <StatusRow tone="done" icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />}>
                  Passkey unlocked
                </StatusRow>
              )}

              <p className="mt-4 text-center text-sm text-on-surface-variant">
                Your voting key is derived in this browser and is never sent to Votex.
              </p>
            </div>
          </section>

          <section
            aria-labelledby="step-2-title"
            className={cn(
              "rounded-xl border p-5 transition-colors sm:p-8",
              stepTwoEnabled
                ? "border-outline-variant bg-surface-container-lowest shadow-ledger"
                : "border-dashed border-outline-variant bg-surface-container-low"
            )}
          >
            <div className="mb-6 flex items-center gap-4">
              <div
                aria-hidden="true"
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                  stepTwoEnabled ? "bg-surface-tint text-white" : "bg-surface-container-highest text-on-surface-variant"
                )}
              >
                2
              </div>
              <div>
                <h2 id="step-2-title" className="font-headline text-xl font-semibold text-primary">
                  Confirm with World ID
                </h2>
                <p className="text-sm text-on-surface-variant">
                  {stepTwoEnabled ? "Prove you are a unique person." : "Available after step 1."}
                </p>
              </div>
            </div>

            {stepTwoEnabled && rpContext && preparedPasskey && (
              <IDKitRequestWidget
                open={widgetOpen}
                onOpenChange={setWidgetOpen}
                app_id={WORLD_ID_APP_ID}
                action={WORLD_ID_ACTION}
                rp_context={rpContext}
                allow_legacy_proofs={true}
                preset={orbLegacy({ signal: preparedPasskey.signal })}
                handleVerify={handleVerify}
                onSuccess={handleWorldIDSuccess}
                onError={handleWorldIDError}
                autoClose
              />
            )}

            {(step === "awaiting-worldid" || (step === "error" && !!preparedPasskey)) &&
              (rpState === "ready" ? (
                <Button
                  onClick={() => {
                    setError(null);
                    setStep("awaiting-worldid");
                    setWidgetOpen(true);
                  }}
                  size="lg"
                  className="w-full justify-center text-base"
                >
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                  {step === "error" ? "Try World ID again" : "Verify with World ID"}
                </Button>
              ) : rpState === "failed" ? (
                <div className="space-y-3" role="alert">
                  <p className="text-sm leading-relaxed text-on-error-container">
                    World ID could not be prepared because Votex did not answer. Check your connection and try again.
                  </p>
                  <Button onClick={() => void fetchRpSignature()} size="lg" variant="outline" className="w-full justify-center text-base">
                    Retry
                  </Button>
                </div>
              ) : (
                <StatusRow tone="busy" icon={<Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}>
                  Preparing World ID…
                </StatusRow>
              ))}

            {step === "registering" && (
              <StatusRow tone="busy" icon={<Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}>
                Linking your passkey to World ID…
              </StatusRow>
            )}

            {step === "complete" && (
              <div className="rounded-xl bg-primary-fixed p-6 text-center" role="status" aria-live="polite">
                <CheckCircle2 className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
                <h2 className="mt-3 font-headline text-2xl font-bold text-primary">Identity confirmed</h2>
                <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
                  {returningIdentity
                    ? "Welcome back. Your passkey and World ID match an existing Votex identity."
                    : "Your Votex identity is ready. Your voting key is derived in this browser and is never sent to Votex."}
                </p>
                <Button type="button" className="mt-5 w-full" size="lg" onClick={() => navigate(nextPath, { replace: true })}>
                  {nextPath === ROUTES.elections ? "Continue to elections" : "Continue"}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            )}

            {!stepTwoEnabled && (
              <div
                aria-disabled="true"
                className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-dashed border-outline-variant px-6 py-3 text-base font-semibold text-on-surface-variant"
              >
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                Verify with World ID
              </div>
            )}
          </section>

          <div className="rounded-xl border border-outline-variant bg-surface-container-low p-5">
            <div className="flex items-start gap-4">
              <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-surface-tint" aria-hidden="true" />
              <div>
                <p className="font-headline text-lg font-bold text-primary">What Votex keeps</p>
                <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
                  Votex stores your pseudonym, the public half of your voting key and a session binding so it can
                  recognise the same person later. It never receives your passkey, your private voting key, or your
                  real-world identity.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-2 text-sm font-semibold text-on-surface-variant">
            <Link to={ROUTES.privacy} className="inline-flex min-h-11 items-center hover:text-primary">Privacy</Link>
            <Link to={ROUTES.auditProtocol} className="inline-flex min-h-11 items-center hover:text-primary">Audit protocol</Link>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex min-h-11 items-center gap-2 hover:text-primary">
              <HelpCircle className="h-4 w-4" aria-hidden="true" />
              Support
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorldIDSignIn;
