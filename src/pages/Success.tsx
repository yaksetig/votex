
import React, { useState, useEffect } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { Link } from 'react-router-dom';
import GenerateKeypairButton from '@/components/GenerateKeypairButton';
import KeypairDisplay from '@/components/KeypairDisplay';
import { KeypairResult, StoredKeypair } from '@/types/keypair';

const Success = () => {
  const { isWorldIDVerified } = useWallet();
  const [keypair, setKeypair] = useState<StoredKeypair | null>(null);

  // Load keypair from localStorage on component mount
  useEffect(() => {
    const storedKeypair = localStorage.getItem('babyJubKeypair');
    if (storedKeypair) {
      try {
        setKeypair(JSON.parse(storedKeypair));
      } catch (e) {
        console.error('Failed to parse stored keypair', e);
      }
    }
  }, []);

  const handleKeypairGenerated = (result: KeypairResult) => {
    setKeypair({
      k: result.k.toString(),
      Ax: result.Ax.toString(),
      Ay: result.Ay.toString(),
    });
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
