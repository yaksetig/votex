
import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { useToast } from "@/hooks/use-toast";
import { BabyJubjubKeyPair, retrieveKeypair, initBabyJubjub } from '@/services/babyJubjubService';

interface WalletContextType {
  isWorldIDVerified: boolean;
  anonymousKeypair: BabyJubjubKeyPair | null;
  setIsWorldIDVerified: (value: boolean) => void;
  setAnonymousKeypair: (keypair: BabyJubjubKeyPair | null) => void;
}

const WalletContext = createContext<WalletContextType>({
  isWorldIDVerified: false,
  anonymousKeypair: null,
  setIsWorldIDVerified: () => {},
  setAnonymousKeypair: () => {},
});

export const useWallet = () => useContext(WalletContext);

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [isWorldIDVerified, setIsWorldIDVerified] = useState(false);
  const [anonymousKeypair, setAnonymousKeypair] = useState<BabyJubjubKeyPair | null>(null);
  const { toast } = useToast();
  
  useEffect(() => {
    const initializeAndLoad = async () => {
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
    };
    
    initializeAndLoad();
  }, [toast]);
  
  const value = {
    isWorldIDVerified,
    anonymousKeypair,
    setIsWorldIDVerified,
    setAnonymousKeypair,
  };
  
  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};
