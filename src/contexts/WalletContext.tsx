
import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { useToast } from "@/hooks/use-toast";
import { clearStoredCredential } from '@/services/passkeyService';

interface WalletContextType {
  isWorldIDVerified: boolean;
  userId: string | null;
  justVerified: boolean;
  derivedPublicKey: { x: string; y: string } | null;
  setIsWorldIDVerified: (value: boolean) => void;
  setUserId: (id: string | null) => void;
  setJustVerified: (value: boolean) => void;
  setDerivedPublicKey: (pk: { x: string; y: string } | null) => void;
  resetIdentity: () => void;
}

const WalletContext = createContext<WalletContextType>({
  isWorldIDVerified: false,
  userId: null,
  justVerified: false,
  derivedPublicKey: null,
  setIsWorldIDVerified: () => {},
  setUserId: () => {},
  setJustVerified: () => {},
  setDerivedPublicKey: () => {},
  resetIdentity: () => {},
});

export const useWallet = () => useContext(WalletContext);

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [isWorldIDVerified, setIsWorldIDVerified] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [justVerified, setJustVerified] = useState(false);
  const [derivedPublicKey, setDerivedPublicKey] = useState<{ x: string; y: string } | null>(null);
  const { toast } = useToast();
  
  // Load identity from storage on component mount
  useEffect(() => {
    // Check if we have a stored user ID
    const storedUserId = localStorage.getItem('worldid-user');
    
    if (storedUserId) {
      console.log('User ID loaded from storage:', storedUserId);
      setUserId(storedUserId);
      setIsWorldIDVerified(true);
      // Don't set justVerified to true for restored sessions
      
      // Note: derivedPublicKey is NOT restored from storage
      // It must be re-derived from passkey on each session for security
      
      toast({
        title: "Authentication loaded",
        description: "Your human identity has been restored.",
      });
    } else {
      console.log('No user ID found in storage');
    }
  }, [toast]); // Only run once on mount
  
  // Function to reset identity (for logout)
  const resetIdentity = () => {
    console.log('Resetting identity...');
    localStorage.removeItem('worldid-user');
    clearStoredCredential(); // Also clear the passkey credential ID
    setUserId(null);
    setIsWorldIDVerified(false);
    setJustVerified(false);
    setDerivedPublicKey(null);
    
    toast({
      title: "Identity reset",
      description: "Your identity has been cleared.",
    });
    console.log('Identity reset complete');
  };
  
  // Expose context values
  const value = {
    isWorldIDVerified,
    userId,
    justVerified,
    derivedPublicKey,
    setIsWorldIDVerified,
    setUserId,
    setJustVerified,
    setDerivedPublicKey,
    resetIdentity
  };
  
  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};

export default WalletProvider;
