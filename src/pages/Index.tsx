
import React from 'react';
import WorldIDVerifier from '@/components/WorldIDVerifier';
import { useWallet } from '@/contexts/WalletContext';
import { Navigate } from 'react-router-dom';

const Index = () => {
  const { isWorldIDVerified } = useWallet();

  // If already verified, redirect to success page
  if (isWorldIDVerified) {
    return <Navigate to="/success" />;
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card p-8 rounded-xl shadow-lg">
        <h1 className="text-3xl font-bold mb-6 text-center">Humanity Check</h1>
        
        <p className="text-center text-muted-foreground mb-8">
          Prove you're a human by verifying with World ID.
        </p>
        
        <div className="flex justify-center">
          <WorldIDVerifier />
        </div>
      </div>
    </div>
  );
};

export default Index;
