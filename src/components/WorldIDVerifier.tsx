
import React, { useState } from 'react';
import { IDKitWidget, ISuccessResult } from '@worldcoin/idkit';
import { useNavigate } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";
import { useWallet } from '@/contexts/WalletContext';
import { processWorldIDVerification, storeWorldIDVerification } from '@/services/worldIdAdapter';

interface WorldIDVerifierProps {
  onVerificationSuccess?: () => void;
}

const WorldIDVerifier: React.FC<WorldIDVerifierProps> = ({ 
  onVerificationSuccess = () => {} 
}) => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();
  const { setIsWorldIDVerified, setUserId } = useWallet();
  const navigate = useNavigate();

  const handleVerificationSuccess = async (result: ISuccessResult) => {
    try {
      setIsVerifying(true);
      setErrorMessage(null);
      console.log('WorldID verification successful');
      
      // Process the verification result
      const verification = processWorldIDVerification(result);
      
      if (!verification.verified) {
        throw new Error("Invalid World ID verification result");
      }
      
      // Store user ID
      const userId = verification.nullifierHash;
      storeWorldIDVerification(userId);
      setUserId(userId);
      
      // Update context
      setIsWorldIDVerified(true);
      
      // Show success toast
      toast({
        title: "Verification successful",
        description: "You've been verified as human.",
      });
      
      // Call success callback
      onVerificationSuccess();
      
      // Navigate to success page
      navigate('/success');
    } catch (err) {
      console.error('Error processing World ID verification:', err);
      setErrorMessage(err instanceof Error ? err.message : "Unknown error occurred");
      toast({
        variant: "destructive",
        title: "Verification failed",
        description: err instanceof Error ? err.message : "An unknown error occurred",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-4">
      <h2 className="text-2xl font-bold">Verify you're human</h2>
      <p className="text-muted-foreground text-center max-w-md">
        Scan the QR code with your World App to verify you're a unique human.
      </p>
      
      {errorMessage && (
        <div className="bg-destructive/20 text-destructive p-3 rounded-md">
          {errorMessage}
        </div>
      )}

      <div className={isVerifying ? "opacity-50 pointer-events-none" : ""}>
        <IDKitWidget
          app_id={process.env.WORLDID_APP_ID || "app_e2fd2f8c99430ab200a093278e801c57"}
          action="register"
          onSuccess={handleVerificationSuccess}
          verification_level="orb"
          handleVerify={async () => true}
        >
          {({ open }) => (
            <button
              onClick={open}
              disabled={isVerifying}
              className="bg-primary hover:bg-primary/80 text-primary-foreground px-6 py-3 rounded-md font-medium flex items-center justify-center transition-colors"
            >
              {isVerifying ? "Verifying..." : "Verify with World ID"}
            </button>
          )}
        </IDKitWidget>
      </div>
    </div>
  );
};

export default WorldIDVerifier;
