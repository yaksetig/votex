/**
 * Passkey Registration Component
 * 
 * This component orchestrates the complete identity registration flow:
 * 1. Create passkey (if not exists) or authenticate with existing
 * 2. Derive BabyJubJub keypair from passkey PRF output
 * 3. Generate signal = Hash(pk) for World ID binding
 * 4. Verify with World ID using the signal
 * 5. Send { pk, worldIdProof, signal } to backend for storage
 * 
 * Security properties:
 * - sk is derived on-demand, never stored
 * - pk is bound to World ID via cryptographic signal
 * - Same passkey → same keypair on any device
 */

import React, { useState, useEffect } from 'react';
import { IDKitWidget, ISuccessResult } from '@worldcoin/idkit';
import { useNavigate } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";
import { useWallet } from '@/contexts/WalletContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Key, Fingerprint, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { 
  checkPasskeySupport, 
  hasExistingPasskey, 
  getOrCreatePasskeySecret,
  type PasskeySupport 
} from '@/services/passkeyService';
import { 
  deriveKeypairFromSecret, 
  hashPublicKeyForSignal,
  publicKeyToStrings 
} from '@/services/deterministicKeyService';
import { supabase } from '@/integrations/supabase/client';

interface PasskeyRegistrationProps {
  onRegistrationComplete?: () => void;
}

type RegistrationStep = 'check-support' | 'ready' | 'passkey' | 'deriving' | 'worldid' | 'registering' | 'complete' | 'error';

const PasskeyRegistration: React.FC<PasskeyRegistrationProps> = ({
  onRegistrationComplete
}) => {
  const [step, setStep] = useState<RegistrationStep>('check-support');
  const [passkeySupport, setPasskeySupport] = useState<PasskeySupport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [derivedSignal, setDerivedSignal] = useState<string | null>(null);
  const [publicKey, setPublicKey] = useState<{ x: string; y: string } | null>(null);
  const [hasPasskey, setHasPasskey] = useState(false);
  
  const { toast } = useToast();
  const { setIsWorldIDVerified, setUserId, setJustVerified, setDerivedPublicKey } = useWallet();
  const navigate = useNavigate();

  // Check passkey support on mount
  useEffect(() => {
    async function checkSupport() {
      try {
        const support = await checkPasskeySupport();
        setPasskeySupport(support);
        setHasPasskey(hasExistingPasskey());
        setStep('ready');
      } catch (err) {
        console.error("Error checking passkey support:", err);
        setError("Failed to check device capabilities");
        setStep('error');
      }
    }
    checkSupport();
  }, []);

  // Start the registration flow
  const startRegistration = async () => {
    setError(null);
    setStep('passkey');
    
    try {
      // Step 1: Get or create passkey and derive PRF secret
      console.log("Getting passkey secret...");
      const prfResult = await getOrCreatePasskeySecret();
      
      // Step 2: Derive BabyJubJub keypair from PRF secret
      setStep('deriving');
      console.log("Deriving keypair from PRF secret...");
      const keypair = await deriveKeypairFromSecret(prfResult.secret);
      
      // Step 3: Hash public key to create World ID signal
      const signal = await hashPublicKeyForSignal(keypair.pk);
      const pkStrings = publicKeyToStrings(keypair.pk);
      
      console.log("Keypair derived, signal:", signal.slice(0, 20) + "...");
      
      // Store for use in World ID verification
      setDerivedSignal(signal);
      setPublicKey(pkStrings);
      
      // Also store the public key in wallet context
      setDerivedPublicKey(pkStrings);
      
      // Step 4: Ready for World ID verification
      setStep('worldid');
      
      toast({
        title: "Keypair derived",
        description: "Please verify with World ID to complete registration.",
      });
      
    } catch (err) {
      console.error("Registration error:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
      setStep('error');
    }
  };

  // Handle World ID verification success
  const handleWorldIDSuccess = async (result: ISuccessResult) => {
    setStep('registering');
    console.log("World ID verification successful, registering keypair...");
    
    try {
      // Send to backend for storage
      const { data, error: invokeError } = await supabase.functions.invoke('register-keypair', {
        body: {
          pk: publicKey,
          worldIdProof: {
            merkle_root: result.merkle_root,
            nullifier_hash: result.nullifier_hash,
            proof: result.proof,
            verification_level: result.verification_level
          },
          signal: derivedSignal
        }
      });
      
      if (invokeError) {
        throw new Error(invokeError.message || "Failed to register keypair");
      }
      
      if (data?.error) {
        throw new Error(data.error);
      }
      
      console.log("Keypair registered successfully");
      
      // Update wallet context
      localStorage.setItem('worldid-user', result.nullifier_hash);
      setUserId(result.nullifier_hash);
      setIsWorldIDVerified(true);
      setJustVerified(true);
      
      setStep('complete');
      
      toast({
        title: "Registration complete!",
        description: "Your identity has been securely bound to your passkey.",
      });
      
      // Call completion callback
      onRegistrationComplete?.();
      
      // Navigate to success
      setTimeout(() => navigate('/success'), 1500);
      
    } catch (err) {
      console.error("Backend registration error:", err);
      setError(err instanceof Error ? err.message : "Failed to complete registration");
      setStep('error');
    }
  };

  // Handle World ID error
  const handleWorldIDError = (error: { code: string; detail?: string }) => {
    console.error("World ID error:", error);
    setError(error.detail || error.code || "World ID verification failed");
    setStep('error');
  };

  // Render based on current step
  if (step === 'check-support') {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="pt-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3">Checking device capabilities...</span>
        </CardContent>
      </Card>
    );
  }

  if (!passkeySupport?.webauthnSupported) {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Device Not Supported
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Your device or browser does not support passkeys. Please use a modern browser 
            (Chrome 116+, Safari 17.4+, or Edge 116+) on a device with a platform authenticator.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (step === 'error') {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Registration Error
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={() => { setError(null); setStep('ready'); }} className="w-full">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === 'complete') {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="pt-6 flex flex-col items-center justify-center gap-4">
          <CheckCircle2 className="h-16 w-16 text-green-500" />
          <h3 className="text-xl font-bold">Registration Complete!</h3>
          <p className="text-muted-foreground text-center">
            Your identity is now securely bound to your passkey.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Create Secure Identity
        </CardTitle>
        <CardDescription>
          {hasPasskey 
            ? "Sign in with your existing passkey to verify your identity."
            : "Create a passkey-protected identity that works across all your devices."
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Step indicators */}
        <div className="flex items-center justify-between text-sm">
          <div className={`flex items-center gap-1 ${step === 'passkey' || step === 'deriving' ? 'text-primary' : 'text-muted-foreground'}`}>
            <Fingerprint className="h-4 w-4" />
            <span>Passkey</span>
          </div>
          <div className="flex-1 h-px bg-border mx-2" />
          <div className={`flex items-center gap-1 ${step === 'deriving' ? 'text-primary' : 'text-muted-foreground'}`}>
            <Key className="h-4 w-4" />
            <span>Derive Key</span>
          </div>
          <div className="flex-1 h-px bg-border mx-2" />
          <div className={`flex items-center gap-1 ${step === 'worldid' || step === 'registering' ? 'text-primary' : 'text-muted-foreground'}`}>
            <Shield className="h-4 w-4" />
            <span>World ID</span>
          </div>
        </div>

        {/* Action buttons based on step */}
        {step === 'ready' && (
          <Button onClick={startRegistration} size="lg" className="w-full" variant="gradient">
            <Fingerprint className="mr-2 h-4 w-4" />
            {hasPasskey ? "Sign in with Passkey" : "Create Passkey"}
          </Button>
        )}

        {(step === 'passkey' || step === 'deriving') && (
          <Button disabled size="lg" className="w-full">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {step === 'passkey' ? "Authenticating with Passkey..." : "Deriving Keypair..."}
          </Button>
        )}

        {step === 'worldid' && derivedSignal && (
          <IDKitWidget
            app_id="app_e2fd2f8c99430ab200a093278e801c57"
            action="registration"
            signal={derivedSignal}
            onSuccess={handleWorldIDSuccess}
            onError={handleWorldIDError}
            autoClose
          >
            {({ open }) => (
              <Button onClick={open} size="lg" className="w-full" variant="gradient">
                <Shield className="mr-2 h-4 w-4" />
                Verify with World ID
              </Button>
            )}
          </IDKitWidget>
        )}

        {step === 'registering' && (
          <Button disabled size="lg" className="w-full">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Completing Registration...
          </Button>
        )}

        {/* Info text */}
        <p className="text-xs text-muted-foreground text-center">
          Your private key is derived from your passkey and never leaves your device.
          World ID ensures one-person-one-vote.
        </p>
      </CardContent>
    </Card>
  );
};

export default PasskeyRegistration;
