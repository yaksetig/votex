
import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { BabyJubjubKeyPair, retrieveKeypair, initBabyJubjub } from '@/services/babyJubjubService';

interface WalletContextType {
  isWorldIDVerified: boolean;
  anonymousKeypair: BabyJubjubKeyPair | null;
  setIsWorldIDVerified: (value: boolean) => void;
  setAnonymousKeypair: (keypair: BabyJubjubKeyPair | null) => void;
  setVerifiedWithKeypair: (keypair: BabyJubjubKeyPair) => void;
}

const WalletContext = createContext<WalletContextType>({
  isWorldIDVerified: false,
  anonymousKeypair: null,
  setIsWorldIDVerified: () => {},
  setAnonymousKeypair: () => {},
  setVerifiedWithKeypair: () => {},
});

export const useWallet = () => useContext(WalletContext);

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [isWorldIDVerified, setIsWorldIDVerified] = useState(false);
  const [anonymousKeypair, setAnonymousKeypair] = useState<BabyJubjubKeyPair | null>(null);
  const { toast } = useToast();
  
  const setVerifiedWithKeypair = useCallback((keypair: BabyJubjubKeyPair) => {
    setAnonymousKeypair(keypair);
    setIsWorldIDVerified(true);
    
    toast({
      title: "Verification successful",
      description: "Your anonymous identity has been created.",
    });
  }, [toast]);
  
  useEffect(() => {
    const initializeAndLoad = async () => {
      try {
        await initBabyJubjub();
        
        const storedKeypair = await retrieveKeypair();
        if (storedKeypair) {
          setAnonymousKeypair(storedKeypair);
          setIsWorldIDVerified(true);
          
          toast({
            title: "Authentication loaded",
            description: "Your anonymous identity has been restored.",
          });
        }
      } catch (error) {
        console.error("Error initializing Baby Jubjub or loading keypair:", error);
        toast({
          title: "Error loading identity",
          description: "Could not load your anonymous identity.",
          variant: "destructive",
        });
      }
    };
    
    initializeAndLoad();
  }, [toast]);
  
  const value = {
    isWorldIDVerified,
    anonymousKeypair,
    setIsWorldIDVerified,
    setAnonymousKeypair,
    setVerifiedWithKeypair
  };
  
  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};
