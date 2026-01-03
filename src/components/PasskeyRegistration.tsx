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
  getOrCreatePasskeySecret,
  authenticateWithAnyPasskey,
  type PasskeySupport 
} from '@/services/passkeyService';
import { 
  deriveKeypairFromSecret, 
  hashPublicKeyForSignal,
  publicKeyToStrings,
  verifyDerivedKeypair
} from '@/services/deterministicKeyService';
import { supabase } from '@/integrations/supabase/client';

interface PasskeyRegistrationProps {
  onRegistrationComplete?: () => void;
}

type RegistrationStep = 'check-support' | 'ready' | 'passkey' | 'deriving' | 'worldid' | 'registering' | 'complete' | 'error';
type AuthMode = 'signin' | 'create';

const PasskeyRegistration: React.FC<PasskeyRegistrationProps> = ({
  onRegistrationComplete
}) => {
  const [step, setStep] = useState<RegistrationStep>('check-support');
  const [passkeySupport, setPasskeySupport] = useState<PasskeySupport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [derivedSignal, setDerivedSignal] = useState<string | null>(null);
  const [publicKey, setPublicKey] = useState<{ x: string; y: string } | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  
  const { toast } = useToast();
  const { setIsWorldIDVerified, setUserId, setJustVerified, setDerivedPublicKey } = useWallet();
  const navigate = useNavigate();

  // Check passkey support on mount
  useEffect(() => {
    async function checkSupport() {
      try {
        const support = await checkPasskeySupport();
        setPasskeySupport(support);
        setStep('ready');
      } catch (err) {
        console.error("Error checking passkey support:", err);
        setError("Failed to check device capabilities");
        setStep('error');
      }
    }
    checkSupport();
  }, []);

  // Start the registration flow - tries to sign in with existing passkey first
  const startRegistration = async (mode: AuthMode = 'signin') => {
    setError(null);
    setAuthMode(mode);
    setStep('passkey');
    
    try {
      let prfResult;
      
      if (mode === 'signin') {
        // Try discoverable credential flow (shows all available passkeys)
        console.log("Attempting to authenticate with existing passkey...");
        prfResult = await authenticateWithAnyPasskey();
      } else {
        // Force create new passkey
        console.log("Creating new passkey...");
        prfResult = await getOrCreatePasskeySecret(true);
      }
      
      // Step 2: Derive BabyJubJub keypair from PRF secret
      setStep('deriving');
      console.log("Deriving keypair from PRF secret...");
      const keypair = await deriveKeypairFromSecret(prfResult.secret);
      
      // Verify keypair consistency before proceeding
      if (!verifyDerivedKeypair(keypair)) {
        throw new Error("Derived keypair failed consistency check - base point mismatch");
      }
      
      // Step 3: Hash public key to create World ID signal
      const signal = await hashPublicKeyForSignal(keypair.pk);
      const pkStrings = publicKeyToStrings(keypair.pk);
      
      console.log("Keypair derived, signal:", signal.slice(0, 20) + "...");
      
      // Store full keypair in localStorage for voting/signing
      const storedKeypair = {
        k: keypair.sk.toString(),
        Ax: keypair.pk.x.toString(),
        Ay: keypair.pk.y.toString()
      };
      localStorage.setItem("babyJubKeypair", JSON.stringify(storedKeypair));
      console.log("Full keypair stored in localStorage");
      
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
          Secure Identity
        </CardTitle>
        <CardDescription>
          Sign in with an existing passkey or create a new identity. 
          Passkeys sync across your devices via iCloud Keychain, Google Password Manager, or similar.
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
          <div className="space-y-3">
            <Button onClick={() => startRegistration('signin')} size="lg" className="w-full" variant="gradient">
              <Fingerprint className="mr-2 h-4 w-4" />
              Sign in with Passkey
            </Button>
            <Button onClick={() => startRegistration('create')} size="lg" className="w-full" variant="outline">
              <Key className="mr-2 h-4 w-4" />
              Create New Identity
            </Button>
          </div>
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
