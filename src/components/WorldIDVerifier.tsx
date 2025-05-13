import React, { useState } from 'react';
import { IDKitWidget, ISuccessResult } from '@worldcoin/idkit';
import { useWallet } from '@/contexts/WalletContext';
import { useToast } from '@/hooks/use-toast';
import { 
  createKeypairFromSeed, 
  storeKeypair,
  getPublicKeyString 
} from '@/services/workingBabyJubjubService';

interface VerifierProps {
  onVerificationSuccess: () => void;
}

const WorldIDVerifier: React.FC<VerifierProps> = ({ onVerificationSuccess }) => {
  const { setIsWorldIDVerified, setUserId, setAnonymousKeypair } = useWallet();
  const { toast } = useToast();
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
      
      // Generate anonymous keypair by creating a deterministic seed from WorldID proof
      // This ensures the keypair is linked to the WorldID verification but not traceable
      console.log("Generating anonymous keypair from WorldID proof");
      const seed = `worldid-${userId}-${result.merkle_root}`;
      const keypair = await createKeypairFromSeed(seed);
      
      // Store the keypair
      storeKeypair(keypair);
      
      // Update the wallet context
      setAnonymousKeypair(keypair);
      
      // Show success toast
      toast({
        title: "Verification successful",
        description: "Your anonymous identity has been created successfully.",
      });
      
      // Call the success callback
      onVerificationSuccess();
    } catch (error) {
      console.error("Error during verification:", error);
      toast({
        title: "Verification failed",
        description: "Could not create your identity. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };
  
  return (
    <div className="my-4">
      <h2 className="text-xl font-bold mb-2">Verify with World ID</h2>
      <p className="mb-4">Verify your identity to enable anonymous voting</p>
      
      {isVerifying ? (
        <div className="bg-gradient-crypto px-4 py-2 rounded-lg opacity-70 cursor-not-allowed flex items-center justify-center space-x-2">
          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Generating your anonymous identity...</span>
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
              className="bg-gradient-crypto px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
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
