
import React, { useState } from 'react';
import { IDKitWidget, ISuccessResult } from '@worldcoin/idkit';
import { useWallet } from '@/contexts/WalletContext';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

interface VerifierProps {
  onVerificationSuccess?: () => void;
}

const WorldIDVerifier: React.FC<VerifierProps> = ({ onVerificationSuccess }) => {
  const { setIsWorldIDVerified, setUserId } = useWallet();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isVerifying, setIsVerifying] = useState(false);
  
  const handleVerificationSuccess = async (result: ISuccessResult) => {
    try {
      setIsVerifying(true);
      
      // Use nullifier_hash as our user ID
      const userId = result.nullifier_hash;
      
      // Store the user ID in localStorage
      localStorage.setItem('worldid-user', userId);
      
      // Update the wallet context
      setUserId(userId);
      setIsWorldIDVerified(true);
      
      // Show success toast
      toast({
        title: "Verification successful",
        description: "You are verified as a human!",
      });
      
      // Navigate to success page
      navigate('/success');
      
      // Call the success callback if provided
      if (onVerificationSuccess) {
        onVerificationSuccess();
      }
    } catch (error) {
      console.error("Error during verification:", error);
      toast({
        title: "Verification failed",
        description: "Could not verify you as a human. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };
  
  return (
    <div className="my-4">
      <h2 className="text-xl font-bold mb-2">Verify with World ID</h2>
      <p className="mb-4">Prove your humanity with World ID</p>
      
      {isVerifying ? (
        <div className="bg-primary/80 text-white px-4 py-2 rounded-lg opacity-70 cursor-not-allowed flex items-center justify-center space-x-2">
          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Verifying your humanity...</span>
        </div>
      ) : (
        <IDKitWidget
          app_id="app_e2fd2f8c99430ab200a093278e801c57" // Replace with your actual World ID app_id
          action="registration"
          onSuccess={handleVerificationSuccess}
          autoClose
        >
          {({ open }) => (
            <button
              onClick={open}
              className="bg-primary px-4 py-2 rounded-lg hover:opacity-90 transition-opacity text-white"
            >
              Verify with World ID
            </button>
          )}
        </IDKitWidget>
      )}
    </div>
  );
};

export default WorldIDVerifier;
