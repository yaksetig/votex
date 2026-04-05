import React, { useState } from "react";
import { IDKitWidget, ISuccessResult } from "@worldcoin/idkit";
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
import {
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
import { createWorldIdSession } from "@/services/worldIdSessionService";

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

const WorldIDSignIn: React.FC = () => {
  const [step, setStep] = useState<SignInStep>("ready");
  const [error, setError] = useState<string | null>(null);
  const [worldIdProof, setWorldIdProof] = useState<ISuccessResult | null>(null);
  const [registrationMode, setRegistrationMode] = useState<RegistrationMode>(null);
  const { toast } = useToast();
  const {
    setDerivedPublicKey,
    setIsWorldIDVerified,
    setJustVerified,
    setUserId,
  } = useWallet();
  const navigate = useNavigate();

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

  const handleReturningUserAuthentication = async (result: ISuccessResult) => {
    setStep("authenticating");

    const prfResult = await authenticateWithPreferredPasskey();
    const keypair = await deriveKeypairFromSecret(prfResult.secret);

    if (!verifyDerivedKeypair(keypair)) {
      throw new Error("Derived keypair failed validation");
    }

    const publicKey = publicKeyToStrings(keypair.pk);
    await completeSession(result.nullifier_hash, prfResult.secret, false, publicKey);

    toast({
      title: "Secure session restored",
      description: "World ID and passkey authentication completed successfully.",
    });

    navigate("/elections", { replace: true });
  };

  const handleWorldIDSuccess = async (result: ISuccessResult) => {
    setStep("checking");
    setError(null);
    setWorldIdProof(result);

    try {
      const { data, error: queryError } = await supabase
        .from("world_id_keypairs")
        .select("nullifier_hash")
        .eq("nullifier_hash", result.nullifier_hash)
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
    if (!worldIdProof) {
      return;
    }

    setError(null);

    try {
      await handleReturningUserAuthentication(worldIdProof);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to authenticate with the existing passkey";
      setError(message);
      setStep("error");
    }
  };

  const handleCreatePasskey = async () => {
    if (!worldIdProof) {
      return;
    }

    setStep("creating-passkey");
    setError(null);

    try {
      let prfResult;
      const userIdBytes = new TextEncoder().encode(worldIdProof.nullifier_hash);

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

      setStep("registering");

      const { data, error: registerError } = await supabase.functions.invoke(
        "register-keypair",
        {
          body: {
            action: "registration",
            pk: publicKey,
            signal,
            worldIdProof: {
              merkle_root: worldIdProof.merkle_root,
              nullifier_hash: worldIdProof.nullifier_hash,
              proof: worldIdProof.proof,
              verification_level: worldIdProof.verification_level,
            },
          },
        }
      );

      if (registerError) {
        throw registerError;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      await completeSession(worldIdProof.nullifier_hash, prfResult.secret, true, publicKey);
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

  const handleWorldIDError = (worldIdError: { code: string; detail?: string }) => {
    setError(worldIdError.detail || worldIdError.code || "World ID verification failed");
    setStep("error");
  };

  const stepOneComplete =
    step === "needs-existing-passkey" ||
    step === "needs-passkey" ||
    step === "creating-passkey" ||
    step === "registering" ||
    step === "complete";
  const showWorldIdButton = step === "ready" || (step === "error" && !worldIdProof);
  const stepTwoEnabled =
    step === "needs-existing-passkey" ||
    step === "needs-passkey" ||
    step === "creating-passkey" ||
    step === "registering" ||
    step === "complete" ||
    (step === "error" && !!worldIdProof);
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

              {showWorldIdButton ? (
                <IDKitWidget
                  app_id={WORLD_ID_APP_ID}
                  action="registration"
                  onSuccess={handleWorldIDSuccess}
                  onError={handleWorldIDError}
                  autoClose
                >
                  {({ open }) => (
                    <Button onClick={open} size="lg" className="w-full justify-center text-base" variant="gradient">
                      <ShieldCheck className="h-5 w-5" />
                      Verify with World ID
                    </Button>
                  )}
                </IDKitWidget>
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

              {(step === "needs-passkey" || (step === "error" && !!worldIdProof && registrationMode === "new")) && (
                <Button
                  onClick={handleCreatePasskey}
                  size="lg"
                  className="w-full justify-center text-base"
                >
                  <KeyRound className="h-5 w-5" />
                  {step === "error" ? "Retry Local Passkey Setup" : "Create Passkey On This Device"}
                </Button>
              )}

              {step === "error" && !!worldIdProof && registrationMode === "existing" && (
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
