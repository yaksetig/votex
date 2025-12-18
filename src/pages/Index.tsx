import React from 'react';
import WorldIDVerifier from '@/components/WorldIDVerifier';
import { useWallet } from '@/contexts/WalletContext';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
const Index = () => {
  const {
    isWorldIDVerified
  } = useWallet();

  // If already verified, redirect directly to elections page
  if (isWorldIDVerified) {
    return <Navigate to="/elections" replace />;
  }
  return <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card p-8 rounded-xl shadow-lg">
        <div className="mb-8 text-center">
          <div className="inline-block p-3 rounded-full bg-primary/10 mb-4">
            <svg className="w-10 h-10 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold mb-2">Humanity Check</h1>
          <p className="text-muted-foreground">Prove you're a human with World ID.</p>
        </div>
        
        <div className="mb-8">
          <div className="bg-muted/50 p-4 rounded-lg mb-6">
            <h2 className="font-medium mb-2">Why verify?</h2>
            <ul className="text-sm space-y-2">
              <li className="flex items-start">
                <svg className="w-4 h-4 text-primary mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Prevent bots and fake accounts</span>
              </li>
              <li className="flex items-start">
                <svg className="w-4 h-4 text-primary mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Secure your identity while maintaining privacy</span>
              </li>
              <li className="flex items-start">
                <svg className="w-4 h-4 text-primary mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>No personal data is shared</span>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="flex justify-center">
          <WorldIDVerifier />
        </div>
      </div>
    </div>;
};
export default Index;