
import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { 
  BabyJubjubKeyPair, 
  retrieveKeypair, 
  initBabyJubjub,
  getPublicKeyString
} from '@/services/ffjavascriptBabyJubjubService';

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
          console.log('Public key:', JSON.stringify(storedKeypair.publicKey));
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
        let errorMessage = "Unknown error";
        if (error instanceof Error) {
          errorMessage = error.message;
          console.error("Error stack:", error.stack);
        }
        console.error("Error initializing Baby Jubjub or loading keypair:", errorMessage);
        
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
      console.log('Refreshing keypair from storage...');
      const storedKeypair = await retrieveKeypair();
      if (storedKeypair) {
        console.log('Keypair refreshed from storage');
        console.log('Public key:', JSON.stringify(storedKeypair.publicKey));
        setAnonymousKeypair(storedKeypair);
        setIsWorldIDVerified(true);
      } else {
        // If no keypair is found, reset the state
        console.log('No keypair found in storage during refresh');
        setAnonymousKeypair(null);
        setIsWorldIDVerified(false);
      }
    } catch (error) {
      let errorMessage = "Unknown error";
      if (error instanceof Error) {
        errorMessage = error.message;
        console.error("Error stack:", error.stack);
      }
      console.error("Error refreshing keypair:", errorMessage);
    }
  }, []);
  
  // Function to reset identity (for logout)
  const resetIdentity = useCallback(() => {
    console.log('Resetting identity...');
    localStorage.removeItem('anonymous-keypair');
    setAnonymousKeypair(null);
    setIsWorldIDVerified(false);
    toast({
      title: "Identity reset",
      description: "Your anonymous identity has been cleared.",
    });
    console.log('Identity reset complete');
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

export default WalletProvider;
