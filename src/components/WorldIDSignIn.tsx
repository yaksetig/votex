/**
 * World ID Sign In Component
 * 
 * For returning users: Quick sign-in using World ID only.
 * Looks up nullifier_hash in world_id_keypairs to restore session.
 * Keypair derivation happens later when needed for voting.
 */

import React, { useState } from 'react';
import { IDKitWidget, ISuccessResult } from '@worldcoin/idkit';
import { useNavigate } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";
import { useWallet } from '@/contexts/WalletContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface WorldIDSignInProps {
  onBack?: () => void;
  onNeedRegistration?: () => void;
}

type SignInStep = 'ready' | 'verifying' | 'checking' | 'error';

const WorldIDSignIn: React.FC<WorldIDSignInProps> = ({
  onBack,
  onNeedRegistration
}) => {
  const [step, setStep] = useState<SignInStep>('ready');
  const [error, setError] = useState<string | null>(null);
  
  const { toast } = useToast();
  const { setIsWorldIDVerified, setUserId, setJustVerified } = useWallet();
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
        console.log("No existing registration found for this World ID");
        toast({
          variant: "destructive",
          title: "Not registered",
          description: "No identity found for this World ID. Please create a new identity first.",
        });
        setError("No identity found. Please create a new identity with a passkey.");
        setStep('error');
        return;
      }
      
      console.log("Found existing registration, restoring session...");
      
      // Restore session - store in localStorage and context
      localStorage.setItem('worldid-user', result.nullifier_hash);
      setUserId(result.nullifier_hash);
      setIsWorldIDVerified(true);
      setJustVerified(true);
      
      toast({
        title: "Welcome back!",
        description: "You're signed in. To vote, you'll need to authenticate with your passkey.",
      });
      
      // Navigate to elections
      navigate('/elections');
      
    } catch (err) {
      console.error("Sign in error:", err);
      setError(err instanceof Error ? err.message : "Failed to sign in");
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
            Sign In Error
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="flex gap-2">
            <Button onClick={() => { setError(null); setStep('ready'); }} className="flex-1" variant="outline">
              Try Again
            </Button>
            {onNeedRegistration && (
              <Button onClick={onNeedRegistration} className="flex-1">
                Create Identity
              </Button>
            )}
          </div>
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
          Quick sign-in for returning users. Verify with World ID to restore your session.
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

        {(step === 'verifying' || step === 'checking') && (
          <Button disabled size="lg" className="w-full">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {step === 'verifying' ? "Verifying..." : "Checking registration..."}
          </Button>
        )}

        {onBack && (
          <Button onClick={onBack} variant="ghost" className="w-full">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        )}

        <p className="text-xs text-muted-foreground text-center">
          To vote, you'll need to authenticate with your passkey after signing in.
        </p>
      </CardContent>
    </Card>
  );
};

export default WorldIDSignIn;
