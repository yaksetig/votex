/**
 * Unified World ID Sign In Component
 * 
 * Single entry point for all users:
 * - Returning users: World ID verification → signed in
 * - New users: World ID verification → passkey creation → registration complete
 */

import React, { useState } from 'react';
import { IDKitWidget, ISuccessResult } from '@worldcoin/idkit';
import { useNavigate } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";
import { useWallet } from '@/contexts/WalletContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Loader2, AlertTriangle, Key, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { authenticateWithAnyPasskey, createPasskeyCredential } from '@/services/passkeyService';
import { deriveKeypairFromSecret, hashPublicKeyForSignal, publicKeyToStrings } from '@/services/deterministicKeyService';

type SignInStep = 'ready' | 'verifying' | 'checking' | 'needs-passkey' | 'creating-passkey' | 'registering' | 'complete' | 'error';

const WorldIDSignIn: React.FC = () => {
  const [step, setStep] = useState<SignInStep>('ready');
  const [error, setError] = useState<string | null>(null);
  const [worldIdProof, setWorldIdProof] = useState<ISuccessResult | null>(null);
  
  const { toast } = useToast();
  const { setIsWorldIDVerified, setUserId, setJustVerified, setDerivedPublicKey } = useWallet();
  const navigate = useNavigate();

  // Handle World ID verification success
  const handleWorldIDSuccess = async (result: ISuccessResult) => {
    setStep('checking');
    console.log("World ID verification successful, checking for existing registration...");
    
    try {
      // Look up nullifier_hash in world_id_keypairs
      const { data, error: queryError } = await supabase
        .from('world_id_keypairs')
        .select('nullifier_hash, public_key_x, public_key_y')
        .eq('nullifier_hash', result.nullifier_hash)
        .single();
      
      if (queryError || !data) {
        // New user - need to create passkey
        console.log("New user detected, prompting for passkey creation");
        setWorldIdProof(result);
        setStep('needs-passkey');
        return;
      }
      
      // Returning user - sign them in
      console.log("Found existing registration, signing in...");
      localStorage.setItem('worldid-user', result.nullifier_hash);
      setUserId(result.nullifier_hash);
      setIsWorldIDVerified(true);
      setJustVerified(true);
      
      toast({
        title: "Welcome back!",
        description: "Authenticate with your passkey when you're ready to vote.",
      });
      
      navigate('/elections');
      
    } catch (err) {
      console.error("Sign in error:", err);
      setError(err instanceof Error ? err.message : "Failed to sign in");
      setStep('error');
    }
  };

  // Handle passkey creation for new users
  const handleCreatePasskey = async () => {
    if (!worldIdProof) return;
    
    setStep('creating-passkey');
    
    try {
      // Try to authenticate with existing passkey first, or create new one
      let prfResult;
      try {
        prfResult = await authenticateWithAnyPasskey();
      } catch {
        // No existing passkey, create one
        const userIdBytes = new TextEncoder().encode(worldIdProof.nullifier_hash);
        await createPasskeyCredential(userIdBytes);
        prfResult = await authenticateWithAnyPasskey();
      }
      
      // Derive keypair
      const keypair = await deriveKeypairFromSecret(prfResult.secret);
      const pkStrings = publicKeyToStrings(keypair.pk);
      const signal = await hashPublicKeyForSignal(keypair.pk);
      
      setStep('registering');
      
      // Register with backend
      const { error: regError } = await supabase.functions.invoke('register-keypair', {
        body: {
          pk: pkStrings,
          worldIdProof: worldIdProof,
          signal: signal
        }
      });
      
      if (regError) throw regError;
      
      // Success - set up session
      localStorage.setItem('worldid-user', worldIdProof.nullifier_hash);
      setUserId(worldIdProof.nullifier_hash);
      setIsWorldIDVerified(true);
      setJustVerified(true);
      setDerivedPublicKey(pkStrings);
      
      setStep('complete');
      
      toast({
        title: "Registration complete!",
        description: "You're ready to vote.",
      });
      
      setTimeout(() => navigate('/elections'), 1500);
      
    } catch (err) {
      console.error("Passkey creation error:", err);
      setError(err instanceof Error ? err.message : "Failed to create passkey");
      setStep('error');
    }
  };

  // Handle World ID error
  const handleWorldIDError = (error: { code: string; detail?: string }) => {
    console.error("World ID error:", error);
    setError(error.detail || error.code || "World ID verification failed");
    setStep('error');
  };

  if (step === 'error') {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Error
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <CheckCircle className="h-5 w-5" />
            Registration Complete
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Redirecting to elections...</p>
        </CardContent>
      </Card>
    );
  }

  if (step === 'needs-passkey') {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            Complete Registration
          </CardTitle>
          <CardDescription>
            Create a passkey to secure your identity and enable voting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleCreatePasskey} size="lg" className="w-full" variant="gradient">
            <Key className="mr-2 h-4 w-4" />
            Create Passkey
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Sign in with World ID
        </CardTitle>
        <CardDescription>
          Verify your identity to access elections.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {step === 'ready' && (
          <IDKitWidget
            app_id="app_e2fd2f8c99430ab200a093278e801c57"
            action="registration"
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

        {(step === 'verifying' || step === 'checking' || step === 'creating-passkey' || step === 'registering') && (
          <Button disabled size="lg" className="w-full">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {step === 'checking' && "Checking registration..."}
            {step === 'creating-passkey' && "Creating passkey..."}
            {step === 'registering' && "Completing registration..."}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default WorldIDSignIn;
