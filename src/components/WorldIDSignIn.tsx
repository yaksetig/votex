import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import type { IDKitResult, RpContext } from "@worldcoin/idkit";
import { MiniKit } from "@worldcoin/minikit-js";
import { useNavigate } from "react-router-dom";
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
import { KEYPAIR_VERSION } from "@/services/eddsaService";
import { createWorldIdSession } from "@/services/worldIdSessionService";

const WorldIdRequestWidget = lazy(() => import("@/components/WorldIdRequestWidget"));

type SignInStep =
  | "ready"
  | "checking"
  | "needs-passkey"
  | "needs-existing-passkey"
  | "authenticating"
  | "creating-passkey"
  | "registering"
  | "complete"
  | "error";

type RegistrationMode = "new" | "existing" | null;

const WORLD_ID_APP_ID = "app_e2fd2f8c99430ab200a093278e801c57";
const WORLD_ID_RP_ID = "rp_b3b4b36db636df22";
const WORLD_ID_ACTION = "registration";

const WorldIDSignIn: React.FC = () => {
  const [step, setStep] = useState<SignInStep>("ready");
  const [error, setError] = useState<string | null>(null);
  const [idkitResult, setIdkitResult] = useState<IDKitResult | null>(null);
  const [registrationMode, setRegistrationMode] = useState<RegistrationMode>(null);
  const [widgetOpen, setWidgetOpen] = useState(false);
  const [shouldLoadWidget, setShouldLoadWidget] = useState(false);
  const [rpContext, setRpContext] = useState<RpContext | null>(null);
  const { toast } = useToast();
  const {
    setDerivedPublicKey,
    setIsWorldIDVerified,
    setJustVerified,
    setUserId,
  } = useWallet();
  const navigate = useNavigate();

  const isInMiniApp = MiniKit.isInstalled();
  const autoOpenTriggered = useRef(false);

  // Auto-open IDKit widget when inside World App (no QR/button needed)
  useEffect(() => {
    if (isInMiniApp && rpContext && step === "ready" && !autoOpenTriggered.current) {
      autoOpenTriggered.current = true;
      setShouldLoadWidget(true);
      setWidgetOpen(true);
    }
  }, [isInMiniApp, rpContext, step]);

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
          console.error("Failed to fetch RP signature:", invokeError);
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
        console.error("Error fetching RP signature:", err);
      }
    }
    fetchRpSignature();
  }, []);

  const completeSession = async (
    nullifierHash: string,
    prfSecret: ArrayBuffer,
    bootstrapVerifier: boolean,
    publicKey?: { x: string; y: string }
  ) => {
    const session = await createWorldIdSession(
      nullifierHash,
      prfSecret,
      bootstrapVerifier
    );

    localStorage.setItem("worldid-user", session.userId);
    setUserId(session.userId);
    setIsWorldIDVerified(true);
    setJustVerified(true);
    if (publicKey) {
      setDerivedPublicKey(publicKey);
    }
  };

  /** Extract nullifier from v4 IDKit result */
  const getNullifier = (result: IDKitResult): string => {
    const responses = (result as Record<string, unknown>).responses as Array<{ nullifier?: string; nullifier_hash?: string }> | undefined;
    if (responses?.[0]?.nullifier) {
      return responses[0].nullifier;
    }
    // Fallback for v3 legacy shape
    const nullifierHash = (result as Record<string, unknown>).nullifier_hash as string | undefined;
    if (nullifierHash) {
      return nullifierHash;
    }
    throw new Error("No nullifier found in IDKit result");
  };

  const handleReturningUserAuthentication = async (result: IDKitResult) => {
    setStep("authenticating");

    const [
      { authenticateWithPreferredPasskey },
      { deriveKeypairFromSecret, publicKeyToStrings, verifyDerivedKeypair },
      { storeKeypair },
    ] = await Promise.all([
      import("@/services/passkeyService"),
      import("@/services/deterministicKeyService"),
      import("@/services/keypairService"),
    ]);

    const prfResult = await authenticateWithPreferredPasskey();
    const keypair = await deriveKeypairFromSecret(prfResult.secret);

    if (!verifyDerivedKeypair(keypair)) {
      throw new Error("Derived keypair failed validation");
    }

    const publicKey = publicKeyToStrings(keypair.pk);
    storeKeypair({
      version: KEYPAIR_VERSION,
      seed: keypair.seedHex,
      k: keypair.sk.toString(),
      Ax: keypair.pk.x.toString(),
      Ay: keypair.pk.y.toString(),
    });

    const nullifier = getNullifier(result);
    await completeSession(nullifier, prfResult.secret, false, publicKey);

    toast({
      title: "Secure session restored",
      description: "World ID and passkey authentication completed successfully.",
    });

    navigate("/elections", { replace: true });
  };

  /** Called by IDKitRequestWidget to verify the proof on our backend */
  const handleVerify = async (result: IDKitResult) => {
    // This is called before onSuccess — if it throws, onSuccess won't fire
    // We don't do full verification here since that happens during registration
    // Just validate the result shape
    const responses = (result as Record<string, unknown>).responses as Array<{ nullifier?: string }> | undefined;
    if (!responses?.[0]?.nullifier) {
      throw new Error("Invalid IDKit result: missing nullifier");
    }
  };

  const handleWorldIDSuccess = async (result: IDKitResult) => {
    setStep("checking");
    setError(null);
    setIdkitResult(result);

    try {
      const nullifier = getNullifier(result);

      const { data, error: queryError } = await supabase
        .from("world_id_keypairs")
        .select("nullifier_hash")
        .eq("nullifier_hash", nullifier)
        .maybeSingle();

      if (queryError) {
        throw queryError;
      }

      if (!data) {
        setRegistrationMode("new");
        setStep("needs-passkey");
        toast({
          title: "World ID confirmed",
          description: "Create a passkey to finish registration and unlock voting.",
        });
        return;
      }

      setRegistrationMode("existing");
      setStep("needs-existing-passkey");
      toast({
        title: "Identity found",
        description: "Use the passkey already bound to this voting identity.",
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to verify World ID session";
      setError(message);
      setStep("error");
    }
  };

  const handleUseExistingPasskey = async () => {
    if (!idkitResult) {
      return;
    }

    setError(null);

    try {
      await handleReturningUserAuthentication(idkitResult);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to authenticate with the existing passkey";
      setError(message);
      setStep("error");
    }
  };

  const handleCreatePasskey = async () => {
    if (!idkitResult) {
      return;
    }

    setStep("creating-passkey");
    setError(null);

    try {
      const [
        { authenticateWithPreferredPasskey, createPasskeyCredential, deriveSecretFromPasskey },
        { deriveKeypairFromSecret, hashPublicKeyForSignal, publicKeyToStrings, verifyDerivedKeypair },
        { storeKeypair },
      ] = await Promise.all([
        import("@/services/passkeyService"),
        import("@/services/deterministicKeyService"),
        import("@/services/keypairService"),
      ]);

      let prfResult;
      const userIdBytes = crypto.getRandomValues(new Uint8Array(32));

      try {
        const credentialId = await createPasskeyCredential(userIdBytes);
        prfResult = await deriveSecretFromPasskey(credentialId);
      } catch (createError) {
        if (
          createError instanceof Error &&
          createError.message === "A passkey already exists for this account"
        ) {
          prfResult = await authenticateWithPreferredPasskey();
        } else {
          throw createError;
        }
      }

      const keypair = await deriveKeypairFromSecret(prfResult.secret);
      if (!verifyDerivedKeypair(keypair)) {
        throw new Error("Derived keypair failed validation");
      }

      const publicKey = publicKeyToStrings(keypair.pk);
      const signal = await hashPublicKeyForSignal(keypair.pk);
      storeKeypair({
        version: KEYPAIR_VERSION,
        seed: keypair.seedHex,
        k: keypair.sk.toString(),
        Ax: keypair.pk.x.toString(),
        Ay: keypair.pk.y.toString(),
      });

      setStep("registering");

      const { data, error: registerError } = await supabase.functions.invoke(
        "register-keypair",
        {
          body: {
            action: WORLD_ID_ACTION,
            pk: publicKey,
            signal,
            idkitResult: idkitResult,
          },
        }
      );

      if (registerError) {
        throw registerError;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const nullifier = getNullifier(idkitResult);
      await completeSession(nullifier, prfResult.secret, true, publicKey);
      setStep("complete");

      toast({
        title: "Identity registration complete",
        description: "Your passkey-backed voting identity is ready.",
      });

      window.setTimeout(() => {
        navigate("/success", { replace: true });
      }, 1200);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create passkey session";
      setError(message);
      setStep("error");
    }
  };

  const handleWorldIDError = (errorCode: unknown) => {
    const code = typeof errorCode === "string" ? errorCode : String(errorCode);
    setError(code || "World ID verification failed");
    setStep("error");
  };

  const stepOneComplete =
    step === "needs-existing-passkey" ||
    step === "needs-passkey" ||
    step === "creating-passkey" ||
    step === "registering" ||
    step === "complete";
  const showWorldIdButton = step === "ready" || (step === "error" && !idkitResult);
  const stepTwoEnabled =
    step === "needs-existing-passkey" ||
    step === "needs-passkey" ||
    step === "creating-passkey" ||
    step === "registering" ||
    step === "complete" ||
    (step === "error" && !!idkitResult);
  const isExistingRegistrationFlow = registrationMode === "existing";

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
            Access your ballot through decentralized proof-of-personhood and a passkey-derived cryptographic identity.
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
                    Authenticate via World ID
                  </h2>
                  <p className="text-sm text-on-surface-variant">
                    Verify that you are a unique human participant.
                  </p>
                </div>
              </div>

              {showWorldIdButton && rpContext ? (
                <>
                  <Button
                    onClick={() => {
                      setShouldLoadWidget(true);
                      setWidgetOpen(true);
                    }}
                    size="lg"
                    className="w-full justify-center text-base"
                    variant="gradient"
                  >
                    <ShieldCheck className="h-5 w-5" />
                    Verify with World ID
                  </Button>
                  {shouldLoadWidget && (
                    <Suspense fallback={null}>
                      <WorldIdRequestWidget
                        open={widgetOpen}
                        onOpenChange={setWidgetOpen}
                        appId={WORLD_ID_APP_ID}
                        action={WORLD_ID_ACTION}
                        rpContext={rpContext}
                        handleVerify={handleVerify}
                        onSuccess={handleWorldIDSuccess}
                        onError={handleWorldIDError}
                      />
                    </Suspense>
                  )}
                </>
              ) : showWorldIdButton && !rpContext ? (
                <Button
                  disabled
                  size="lg"
                  className="w-full justify-center text-base"
                  variant="gradient"
                >
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Initializing...
                </Button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="flex w-full items-center justify-center gap-3 rounded-[1rem] bg-gradient-to-br from-primary to-primary-container px-6 py-4 text-lg font-bold text-white opacity-95"
                >
                  {stepOneComplete ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  )}
                  {stepOneComplete
                    ? "World ID Verified"
                    : step === "authenticating"
                      ? "Authenticating with Passkey..."
                      : "Checking registration..."}
                </button>
              )}

              <p className="mt-4 text-center text-[11px] font-bold uppercase tracking-[0.24em] text-outline">
                Privacy-first zero knowledge proof
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
                  {isExistingRegistrationFlow ? "Use Existing Passkey" : "Register a Passkey"}
                </h2>
                <p className="text-sm text-on-surface-variant">
                  {isExistingRegistrationFlow
                    ? "Unlock with the passkey already bound to this voting identity."
                    : "Create a biometric-backed passkey on this device and derive your local voting key."}
                </p>
              </div>
            </div>

              {step === "needs-existing-passkey" && (
                <Button
                  onClick={handleUseExistingPasskey}
                  size="lg"
                  className="w-full justify-center text-base"
                >
                  <KeyRound className="h-5 w-5" />
                  Use Previously Generated Passkey
                </Button>
              )}

              {(step === "needs-passkey" || (step === "error" && !!idkitResult && registrationMode === "new")) && (
                <Button
                  onClick={handleCreatePasskey}
                  size="lg"
                  className="w-full justify-center text-base"
                >
                  <KeyRound className="h-5 w-5" />
                  {step === "error" ? "Retry Local Passkey Setup" : "Create Passkey On This Device"}
                </Button>
              )}

              {step === "error" && !!idkitResult && registrationMode === "existing" && (
                <Button
                  onClick={handleUseExistingPasskey}
                  size="lg"
                  className="w-full justify-center text-base"
                >
                  <KeyRound className="h-5 w-5" />
                  Retry Existing Passkey
                </Button>
              )}

            {(step === "creating-passkey" || step === "registering") && (
              <button
                type="button"
                disabled
                className="flex w-full items-center justify-center gap-3 rounded-[1rem] bg-surface-container-high px-6 py-4 text-lg font-bold text-on-surface-variant"
              >
                <Loader2 className="h-5 w-5 animate-spin" />
                {step === "creating-passkey"
                  ? "Creating passkey..."
                  : "Binding identity to passkey..."}
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
                <KeyRound className="h-5 w-5" />
                Setup Passkey
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
            <a href="#privacy">Privacy Policy</a>
            <a href="#audit">Audit Protocol</a>
            <button type="button" className="inline-flex items-center gap-2">
              <HelpCircle className="h-4 w-4" />
              Support
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorldIDSignIn;
