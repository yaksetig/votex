
import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { BabyJubjubKeyPair, retrieveKeypair, initBabyJubjub } from '@/services/babyJubjubService';

interface WalletContextType {
  isWorldIDVerified: boolean;
  anonymousKeypair: BabyJubjubKeyPair | null;
  setIsWorldIDVerified: (value: boolean) => void;
  setAnonymousKeypair: (keypair: BabyJubjubKeyPair | null) => void;
  resetIdentity: () => void;
  refreshKeypair: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType>({
  isWorldIDVerified: false,
  anonymousKeypair: null,
  setIsWorldIDVerified: () => {},
  setAnonymousKeypair: () => {},
  resetIdentity: () => {},
  refreshKeypair: async () => {},
});

export const useWallet = () => useContext(WalletContext);

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [isWorldIDVerified, setIsWorldIDVerified] = useState(false);
  const [anonymousKeypair, setAnonymousKeypair] = useState<BabyJubjubKeyPair | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const { toast } = useToast();
  
  // Initialize Baby Jubjub and load keypair from storage
  useEffect(() => {
    const initializeAndLoad = async () => {
      try {
        console.log('Initializing Baby Jubjub...');
        await initBabyJubjub();
        
        const storedKeypair = await retrieveKeypair();
        if (storedKeypair) {
          console.log('Keypair loaded from storage');
          setAnonymousKeypair(storedKeypair);
          setIsWorldIDVerified(true);
          
          toast({
            title: "Authentication loaded",
            description: "Your anonymous identity has been restored.",
          });
        } else {
          console.log('No keypair found in storage');
        }
      } catch (error) {
        console.error("Error initializing Baby Jubjub or loading keypair:", error);
        toast({
          title: "Error loading identity",
          description: "Could not load your anonymous identity.",
          variant: "destructive",
        });
      } finally {
        setIsInitialized(true);
      }
    };
    
    initializeAndLoad();
  }, [toast]);
  
  // Function to refresh the keypair from storage
  const refreshKeypair = useCallback(async () => {
    try {
      const storedKeypair = await retrieveKeypair();
      if (storedKeypair) {
        setAnonymousKeypair(storedKeypair);
        setIsWorldIDVerified(true);
        console.log('Keypair refreshed from storage');
      } else {
        // If no keypair is found, reset the state
        setAnonymousKeypair(null);
        setIsWorldIDVerified(false);
        console.log('No keypair found in storage during refresh');
      }
    } catch (error) {
      console.error("Error refreshing keypair:", error);
    }
  }, []);
  
  // Function to reset identity (for logout)
  const resetIdentity = useCallback(() => {
    localStorage.removeItem('anonymous-keypair');
    setAnonymousKeypair(null);
    setIsWorldIDVerified(false);
    toast({
      title: "Identity reset",
      description: "Your anonymous identity has been cleared.",
    });
  }, [toast]);
  
  const value = {
    isWorldIDVerified,
    anonymousKeypair,
    setIsWorldIDVerified,
    setAnonymousKeypair,
    resetIdentity,
    refreshKeypair
  };
  
  // Show loading state while initializing
  if (!isInitialized) {
    return <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground">Initializing wallet...</p>
    </div>;
  }
  
  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};
