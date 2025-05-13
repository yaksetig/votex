
import React, { useState, useEffect } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { Link } from 'react-router-dom';
import GenerateKeypairButton from '@/components/GenerateKeypairButton';
import KeypairDisplay from '@/components/KeypairDisplay';
import { KeypairResult, StoredKeypair } from '@/types/keypair';
import { isKeypairRegistered } from '@/services/keypairService';
import { useToast } from '@/hooks/use-toast';

const Success = () => {
  const { isWorldIDVerified } = useWallet();
  const [keypair, setKeypair] = useState<StoredKeypair | null>(null);
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null);
  const { toast } = useToast();

  // Load keypair from localStorage on component mount
  useEffect(() => {
    const storedKeypair = localStorage.getItem('babyJubKeypair');
    if (storedKeypair) {
      try {
        const parsedKeypair = JSON.parse(storedKeypair);
        setKeypair(parsedKeypair);
        
        // Check if keypair is already registered
        checkRegistrationStatus(parsedKeypair);
      } catch (e) {
        console.error('Failed to parse stored keypair', e);
      }
    }
  }, []);

  const checkRegistrationStatus = async (keypair: StoredKeypair) => {
    try {
      const registered = await isKeypairRegistered(keypair);
      setIsRegistered(registered);
      
      if (registered) {
        toast({
          title: "Keypair status",
          description: "This keypair is already registered in the system.",
        });
      }
    } catch (error) {
      console.error('Error checking registration status:', error);
    }
  };

  const handleKeypairGenerated = (result: KeypairResult) => {
    const storedKeypair = {
      k: result.k.toString(),
      Ax: result.Ax.toString(),
      Ay: result.Ay.toString(),
    };
    setKeypair(storedKeypair);
    setIsRegistered(true); // Assume registration is successful as the GenerateKeypairButton handles it
  };

  if (!isWorldIDVerified) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold text-red-500 mb-4">Not Verified</h1>
        <p className="text-center mb-6">You need to verify yourself as a human first.</p>
        <Link to="/" className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary/80">
          Go to Verification
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-card p-8 rounded-xl shadow-lg">
        <div className="flex justify-center mb-6">
          <div className="bg-green-100 p-4 rounded-full">
            <svg className="h-12 w-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-center mb-4">You're a Human! 🎉</h1>
        
        <p className="text-center text-muted-foreground mb-6">
          Your humanity has been verified with World ID.
        </p>
        
        {!keypair ? (
          <div className="mb-6">
            <p className="text-center text-muted-foreground mb-4">
              Generate a cryptographic keypair to use with privacy-preserving applications.
            </p>
            <GenerateKeypairButton onKeypairGenerated={handleKeypairGenerated} />
          </div>
        ) : (
          <div className="mb-6">
            <KeypairDisplay keypair={keypair} />
            {isRegistered !== null && (
              <div className={`mt-4 p-3 rounded-md ${isRegistered ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                {isRegistered 
                  ? "This keypair is registered in the system."
                  : "This keypair is not yet registered. Generate a new one to register."}
              </div>
            )}
          </div>
        )}
        
        <div className="flex justify-center mt-6">
          <Link to="/" className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary/80">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Success;
