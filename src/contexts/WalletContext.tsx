import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { 
  BabyJubjubKeyPair, 
  initBabyJubjub, 
  generateKeypair, 
  storeKeypair, 
  retrieveKeypair,
  getPublicKeyString
} from '@/services/fixedBabyJubjubService';

interface WalletContextType {
  isWorldIDVerified: boolean;
  userId: string | null;
  anonymousKeypair: BabyJubjubKeyPair | null;
  publicKeyString: string | null;
  setIsWorldIDVerified: (value: boolean) => void;
  setUserId: (id: string | null) => void;
  generateAnonymousKeypair: () => Promise<BabyJubjubKeyPair>;
  setAnonymousKeypair: (keypair: BabyJubjubKeyPair) => void;
  resetIdentity: () => void;
}

const WalletContext = createContext<WalletContextType>({
  isWorldIDVerified: false,
  userId: null,
  anonymousKeypair: null,
  publicKeyString: null,
  setIsWorldIDVerified: () => {},
  setUserId: () => {},
  generateAnonymousKeypair: async () => ({ privateKey: new Uint8Array(), publicKey: [new Uint8Array(), new Uint8Array()] }),
  setAnonymousKeypair: () => {},
  resetIdentity: () => {},
});

export const useWallet = () => useContext(WalletContext);

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [isWorldIDVerified, setIsWorldIDVerified] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [anonymousKeypair, setAnonymousKeypair] = useState<BabyJubjubKeyPair | null>(null);
  const [publicKeyString, setPublicKeyString] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const { toast } = useToast();
  
  // Initialize BabyJubjub library before anything else
  useEffect(() => {
    const initialize = async () => {
      try {
        // Initialize BabyJubjub first and await it completely
        await initBabyJubjub();
        console.log("BabyJubjub initialized successfully");
        
        // Only after initialization, we can load identity
        await loadIdentity();
      } catch (error) {
        console.error("Error initializing BabyJubjub:", error);
        toast({
          title: "Initialization Error",
          description: "Could not initialize cryptographic libraries. Please try again.",
          variant: "destructive",
        });
        // Still mark as initialized to show the UI
        setIsInitialized(true);
      }
    };
    
    initialize();
  }, []);
  
  // Load identity from storage
  const loadIdentity = async () => {
    try {
      // Check if we have a stored user ID
      const storedUserId = localStorage.getItem('worldid-user');
      
      if (storedUserId) {
        console.log('User ID loaded from storage:', storedUserId);
        setUserId(storedUserId);
        setIsWorldIDVerified(true);
        
        // Try to load keypair
        const storedKeypair = await retrieveKeypair();
        if (storedKeypair) {
          console.log('Anonymous keypair loaded from storage');
          setAnonymousKeypair(storedKeypair);
          const pubKeyStr = getPublicKeyString(storedKeypair.publicKey);
          setPublicKeyString(pubKeyStr);
          console.log('Public key string:', pubKeyStr.substring(0, 30) + '...');
          
          toast({
            title: "Authentication loaded",
            description: "Your identity has been restored.",
          });
        } else {
          console.log('No keypair found in storage');
        }
      } else {
        console.log('No user ID found in storage');
      }
    } catch (error) {
      console.error("Error loading identity:", error);
      
      toast({
        title: "Error loading identity",
        description: "Could not load your identity.",
        variant: "destructive",
      });
    } finally {
      setIsInitialized(true);
    }
  };
  
  // Generate a new anonymous keypair
  const generateAnonymousKeypair = useCallback(async (): Promise<BabyJubjubKeyPair> => {
    try {
      // Ensure BabyJubjub is initialized first
      await initBabyJubjub();
      
      console.log('Generating new anonymous keypair...');
      const keypair = await generateKeypair();
      
      // Store the keypair
      storeKeypair(keypair);
      
      // Update state
      setAnonymousKeypair(keypair);
      const pubKeyStr = getPublicKeyString(keypair.publicKey);
      setPublicKeyString(pubKeyStr);
      
      console.log('Anonymous keypair generated successfully');
      
      return keypair;
    } catch (error) {
      console.error("Error generating anonymous keypair:", error);
      toast({
        title: "Keypair Generation Failed",
        description: "Could not generate your anonymous identity.",
        variant: "destructive",
      });
      throw error;
    }
  }, [toast]);
  
  // Function to update the anonymous keypair
  const handleSetAnonymousKeypair = useCallback((keypair: BabyJubjubKeyPair) => {
    setAnonymousKeypair(keypair);
    const pubKeyStr = getPublicKeyString(keypair.publicKey);
    setPublicKeyString(pubKeyStr);
  }, []);
  
  // Function to reset identity (for logout)
  const resetIdentity = useCallback(() => {
    console.log('Resetting identity...');
    localStorage.removeItem('worldid-user');
    localStorage.removeItem('anonymous-keypair');
    setUserId(null);
    setIsWorldIDVerified(false);
    setAnonymousKeypair(null);
    setPublicKeyString(null);
    toast({
      title: "Identity reset",
      description: "Your identity has been cleared.",
    });
    console.log('Identity reset complete');
  }, [toast]);
  
  // Expose context values
  const value = {
    isWorldIDVerified,
    userId,
    anonymousKeypair,
    publicKeyString,
    setIsWorldIDVerified,
    setUserId,
    generateAnonymousKeypair,
    setAnonymousKeypair: handleSetAnonymousKeypair,
    resetIdentity
  };
  
  // Show loading state while initializing
  if (!isInitialized) {
    return <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground">Initializing cryptographic libraries...</p>
    </div>;
  }
  
  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};

export default WalletProvider;
