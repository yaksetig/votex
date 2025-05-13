import React, { useState } from 'react';
import { IDKitWidget, ISuccessResult, CredentialType } from '@worldcoin/idkit';
import { useNavigate } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";
import { useWallet } from '@/contexts/WalletContext';
import { ethers } from 'ethers';

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
      console.log('WorldID verification result:', result);
      
      // Store the nullifier hash as the user ID
      const nullifierHash = result.nullifier_hash;
      
      // Store in localStorage for persistence
      localStorage.setItem('worldid-user', nullifierHash);
      setUserId(nullifierHash);
      
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

  // This function will be called when the verification process fails
  const handleVerificationError = (error: Error) => {
    console.error('World ID verification error:', error);
    setErrorMessage(error.message);
    toast({
      variant: "destructive",
      title: "Verification failed",
      description: error.message,
    });
    setIsVerifying(false);
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
        app_id="app_e2fd2f8c99430ab200a093278e801c57"
        action="registration"
        onSuccess={handleVerificationSuccess}
        autoClose
      >
        {({ open }) => (
          <button onClick={open}>Verify with World ID</button>
        )}
      </IDKitWidget>
      </div>
    </div>
  );
};

export default WorldIDVerifier;
