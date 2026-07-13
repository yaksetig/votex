import React, { useState, useEffect } from "react";
import {
  IDKitRequestWidget,
  orbLegacy,
  type IDKitResult,
  type RpContext,
} from "@worldcoin/idkit";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Fingerprint,
  HelpCircle,
  KeyRound,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/WalletContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  authenticateWithPasskeyPicker,
  authenticateWithPreferredPasskey,
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
import { readFunctionError, VotexApiError } from "@/types/api";

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
const WORLD_ID_RP_ID = "rp_b3b4b36db636df22";
const WORLD_ID_ACTION = "registration";

type PasskeyPreparationMode = "existing" | "new" | "picker";

const WorldIDSignIn: React.FC = () => {
  const [step, setStep] = useState<SignInStep>("ready");
  const [error, setError] = useState<string | null>(null);
  const [preparedPasskey, setPreparedPasskey] = useState<PreparedPasskey | null>(null);
  const [hasKeyConflict, setHasKeyConflict] = useState(false);
  const [widgetOpen, setWidgetOpen] = useState(false);
  const [rpContext, setRpContext] = useState<RpContext | null>(null);
  const { toast } = useToast();
  const {
    setDerivedPublicKey,
    setIsWorldIDVerified,
    setJustVerified,
    setUserId,
  } = useWallet();
  const navigate = useNavigate();

  // Fetch RP signature on mount
  useEffect(() => {
    async function fetchRpSignature() {
      try {
        const { data, error: invokeError } = await supabase.functions.invoke(
          "rp-signature",
          {
            body: { action: WORLD_ID_ACTION },
          }
        );

        if (invokeError || !data) {
          logger.error("Failed to fetch RP signature");
          return;
        }

        setRpContext({
          rp_id: WORLD_ID_RP_ID,
          nonce: data.nonce,
          created_at: data.created_at,
          expires_at: data.expires_at,
          signature: data.sig,
        });
      } catch (err) {
        logger.error("Error fetching RP signature", err);
      }
    }
    fetchRpSignature();
  }, []);

  const completeSession = async (
    nullifierHash: string,
    prfSecret: ArrayBuffer,
    publicKey?: { x: string; y: string }
  ) => {
    const session = await createWorldIdSession(nullifierHash, prfSecret);

    setUserId(session.userId);
    setIsWorldIDVerified(true);
    setJustVerified(true);
    if (publicKey) {
      setDerivedPublicKey(publicKey);
    }
  };

  /** Extract nullifier from v4 IDKit result */
  const getNullifier = (result: IDKitResult): string => {
    const record = result as unknown as Record<string, unknown>;
    const responses = record.responses as Array<{ nullifier?: string; nullifier_hash?: string }> | undefined;
    if (responses?.[0]?.nullifier) {
      return responses[0].nullifier;
    }
    // Fallback for v3 legacy shape
    const nullifierHash = record.nullifier_hash as string | undefined;
    if (nullifierHash) {
      return nullifierHash;
    }
    throw new Error("No nullifier found in IDKit result");
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
      } else if (mode === "picker") {
        // A conflict usually means the locally remembered credential is a
        // second passkey created by the old create-first onboarding flow. The
        // discoverable credential picker lets the voter select the original.
        prfResult = await authenticateWithPasskeyPicker();
      } else {
        // Returning users must authenticate first. Creating a credential here
        // can produce a different PRF secret and therefore a different voting
        // key for the same World ID.
        prfResult = await authenticateWithPreferredPasskey();
      }

      const keypair = await deriveKeypairFromSecret(prfResult.secret);
      if (!verifyDerivedKeypair(keypair)) {
        throw new Error("Derived keypair failed validation");
      }

      const publicKey = publicKeyToStrings(keypair.pk);
      const signal = await hashPublicKeyForSignal(keypair.pk);
      const verifierHash = await deriveSessionVerifierHash(prfResult.secret);

      setPreparedPasskey({
        prfSecret: prfResult.secret,
        publicKey,
        signal,
        verifierHash,
      });
      setStep("awaiting-worldid");
      setWidgetOpen(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to prepare passkey";
      setError(message);
      setStep("error");
    }
  };

  /** Called by IDKitRequestWidget to verify the proof on our backend */
  const handleVerify = async (result: IDKitResult) => {
    // This is called before onSuccess — if it throws, onSuccess won't fire
    // We don't do full verification here since that happens during registration
    // Just validate the result shape
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
      setError("Passkey was not prepared before World ID verification");
      setStep("error");
      return;
    }

    setStep("registering");
    setError(null);

    try {
      const { prfSecret, publicKey, signal, verifierHash } = preparedPasskey;

      // verifierHash is registered here, under the verified World ID proof;
      // worldid-session refuses to issue sessions for identities without one.
      const { data, error: registerError } = await supabase.functions.invoke(
        "register-keypair",
        {
          body: {
            action: WORLD_ID_ACTION,
            pk: publicKey,
            signal,
            idkitResult: result,
            verifierHash,
          },
        }
      );

      if (registerError) {
        throw await readFunctionError(
          registerError,
          "CONFLICT",
          "Failed to bind World ID to the selected passkey"
        );
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const nullifier = getNullifier(result);
      await completeSession(nullifier, prfSecret, publicKey);
      setStep("complete");

      const returning = data?.alreadyExists === true;
      toast({
        title: returning ? "Secure session restored" : "Identity registration complete",
        description: returning
          ? "World ID and passkey authentication completed successfully."
          : "Your passkey-backed voting identity is ready.",
      });

      window.setTimeout(() => {
        navigate(returning ? "/elections" : "/success", { replace: true });
      }, 1200);
    } catch (err) {
      if (
        err instanceof VotexApiError &&
        (err.code === "KEYPAIR_ALREADY_BOUND" ||
          err.message.toLowerCase().includes("already bound"))
      ) {
        setPreparedPasskey(null);
        setWidgetOpen(false);
        setHasKeyConflict(true);
        setError(
          "This World ID is already linked to another Votex passkey. Choose the original passkey you used on votex.world; a newly created passkey produces a different voting key."
        );
        setStep("error");
        return;
      }

      const message =
        err instanceof Error ? err.message : "Failed to register voting identity";
      setError(message);
      setStep("error");
    }
  };

  const handleWorldIDError = (errorCode: unknown) => {
    const code = typeof errorCode === "string" ? errorCode : String(errorCode);
    setError(code || "World ID verification failed");
    setStep("error");
  };

  const showPasskeyActions =
    step === "ready" || (step === "error" && !preparedPasskey);
  const stepTwoEnabled =
    step === "awaiting-worldid" ||
    step === "registering" ||
    step === "complete" ||
    (step === "error" && !!preparedPasskey);

  return (
    <div className="relative flex min-h-[calc(100vh-72px)] items-center justify-center overflow-hidden px-4 py-8 sm:px-6">
      <div className="absolute inset-0 ledger-grid-glow opacity-80" />

      <div className="relative z-10 w-full max-w-5xl">
        <div className="text-center">
          <span className="ledger-badge bg-secondary-container text-on-secondary-container">
            <ShieldCheck className="h-4 w-4" />
            Secure voting portal
          </span>
          <h1 className="mt-6 font-headline text-4xl font-extrabold tracking-tight text-primary md:text-6xl">
            Verify Your <span className="text-surface-tint">Identity.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-on-surface-variant">
            Access your ballot through World ID proof-of-personhood and a passkey-derived cryptographic identity.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-2xl space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <section className="ledger-panel relative overflow-hidden p-8">
            <div className="absolute right-0 top-0 p-6 opacity-[0.06]">
              <Fingerprint className="h-28 w-28" />
            </div>

            <div className="relative z-10">
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-on-primary font-headline font-bold">
                  1
                </div>
                <div>
                  <h2 className="font-headline text-2xl font-bold text-primary">
                    Unlock Your Voting Passkey
                  </h2>
                  <p className="text-sm text-on-surface-variant">
                    Returning voters should use the same passkey they originally registered.
                  </p>
                </div>
              </div>

              {showPasskeyActions ? (
                <div className="space-y-3">
                  <Button
                    onClick={() => preparePasskey(hasKeyConflict ? "picker" : "existing")}
                    size="lg"
                    className="w-full justify-center text-base"
                    variant="gradient"
                  >
                    <KeyRound className="h-5 w-5" />
                    {hasKeyConflict
                      ? "Choose Your Original Votex Passkey"
                      : "Use an Existing Votex Passkey"}
                  </Button>

                  {!hasKeyConflict && (
                    <>
                      <div className="flex items-center gap-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-outline">
                        <span className="h-px flex-1 bg-outline-variant" />
                        First time here?
                        <span className="h-px flex-1 bg-outline-variant" />
                      </div>
                      <Button
                        onClick={() => preparePasskey("new")}
                        size="lg"
                        className="w-full justify-center text-base"
                        variant="outline"
                      >
                        <Fingerprint className="h-5 w-5" />
                        Create a New Votex Passkey
                      </Button>
                      <p className="text-center text-xs leading-relaxed text-on-surface-variant">
                        Only create one if you have never registered on votex.world. A new passkey creates a new cryptographic voting identity.
                      </p>
                    </>
                  )}
                </div>
              ) : step === "preparing-passkey" ? (
                <button
                  type="button"
                  disabled
                  className="flex w-full items-center justify-center gap-3 rounded-[1rem] bg-gradient-to-br from-primary to-primary-container px-6 py-4 text-lg font-bold text-white opacity-95"
                >
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Setting up passkey...
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="flex w-full items-center justify-center gap-3 rounded-[1rem] bg-gradient-to-br from-primary to-primary-container px-6 py-4 text-lg font-bold text-white opacity-95"
                >
                  <CheckCircle2 className="h-5 w-5" />
                  Passkey Ready
                </button>
              )}

              <p className="mt-4 text-center text-[11px] font-bold uppercase tracking-[0.24em] text-outline">
                Local key never leaves this device
              </p>
            </div>
          </section>

          <section
            className={[
              "rounded-[2rem] border p-8 transition-all",
              stepTwoEnabled
                ? "border-outline-variant/12 bg-surface-container-lowest shadow-ledger"
                : "border-dashed border-outline-variant bg-surface-container opacity-60",
            ].join(" ")}
          >
            <div className="mb-6 flex items-center gap-4">
              <div
                className={[
                  "flex h-12 w-12 items-center justify-center rounded-full font-headline font-bold",
                  stepTwoEnabled
                    ? "bg-surface-tint text-white"
                    : "bg-outline-variant text-on-surface-variant",
                ].join(" ")}
              >
                2
              </div>
              <div>
                <h2 className="font-headline text-2xl font-bold text-primary">
                  Authenticate via World ID
                </h2>
                <p className="text-sm text-on-surface-variant">
                  Verify that you are a unique human participant.
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

            {(step === "awaiting-worldid" || (step === "error" && !!preparedPasskey)) && (
              rpContext ? (
                <Button
                  onClick={() => {
                    setError(null);
                    setStep("awaiting-worldid");
                    setWidgetOpen(true);
                  }}
                  size="lg"
                  className="w-full justify-center text-base"
                  variant="gradient"
                >
                  <ShieldCheck className="h-5 w-5" />
                  {step === "error" ? "Retry World ID" : "Verify with World ID"}
                </Button>
              ) : (
                <Button
                  disabled
                  size="lg"
                  className="w-full justify-center text-base"
                  variant="gradient"
                >
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Initializing...
                </Button>
              )
            )}

            {step === "registering" && (
              <button
                type="button"
                disabled
                className="flex w-full items-center justify-center gap-3 rounded-[1rem] bg-surface-container-high px-6 py-4 text-lg font-bold text-on-surface-variant"
              >
                <Loader2 className="h-5 w-5 animate-spin" />
                Binding identity to passkey...
              </button>
            )}

            {step === "complete" && (
              <div className="flex items-center justify-center gap-3 rounded-[1rem] bg-primary-fixed px-6 py-4 text-lg font-bold text-primary">
                <CheckCircle2 className="h-5 w-5" />
                Identity Confirmed
              </div>
            )}

            {!stepTwoEnabled && (
              <button
                type="button"
                disabled
                className="flex w-full items-center justify-center gap-3 rounded-[1rem] bg-surface-container-high px-6 py-4 text-lg font-bold text-on-surface-variant"
              >
                <ShieldCheck className="h-5 w-5" />
                Verify with World ID
              </button>
            )}
          </section>

          <div className="rounded-[1.75rem] border border-outline-variant/12 bg-surface-container-low p-5">
            <div className="flex items-start gap-4">
              <ShieldCheck className="mt-1 h-5 w-5 text-surface-tint" />
              <div>
                <p className="font-headline text-lg font-bold text-primary">
                  Cryptographic Integrity
                </p>
                <p className="mt-2 text-sm leading-relaxed text-on-secondary-container">
                  Your cryptographic identity is derived from your passkey and used only locally for vote signing and protected session recovery. Server-side state stores only the verifier and session bindings needed to authenticate the same person later.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-6 pt-4 text-xs font-semibold uppercase tracking-[0.2em] text-outline">
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/audit-protocol">Audit Protocol</Link>
            <a href="mailto:support@votex.world" className="inline-flex items-center gap-2">
              <HelpCircle className="h-4 w-4" />
              Support
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorldIDSignIn;
