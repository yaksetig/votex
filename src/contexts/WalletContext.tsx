
import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";

interface WalletContextType {
  isWorldIDVerified: boolean;
  userId: string | null;
  setIsWorldIDVerified: (value: boolean) => void;
  setUserId: (id: string | null) => void;
  resetIdentity: () => void;
}

const WalletContext = createContext<WalletContextType>({
  isWorldIDVerified: false,
  userId: null,
  setIsWorldIDVerified: () => {},
  setUserId: () => {},
  resetIdentity: () => {},
});

export const useWallet = () => useContext(WalletContext);

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [isWorldIDVerified, setIsWorldIDVerified] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const { toast } = useToast();
  
  // Load identity from storage
  useEffect(() => {
    const initializeAndLoad = async () => {
      try {
        // Check if we have a stored user ID
        const storedUserId = localStorage.getItem('worldid-user');
        
        if (storedUserId) {
          console.log('User ID loaded from storage');
          setUserId(storedUserId);
          setIsWorldIDVerified(true);
          
          toast({
            title: "Authentication loaded",
            description: "Your identity has been restored.",
          });
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
    
    initializeAndLoad();
  }, [toast]);
  
  // Function to reset identity (for logout)
  const resetIdentity = useCallback(() => {
    console.log('Resetting identity...');
    localStorage.removeItem('worldid-user');
    setUserId(null);
    setIsWorldIDVerified(false);
    toast({
      title: "Identity reset",
      description: "Your identity has been cleared.",
    });
    console.log('Identity reset complete');
  }, [toast]);
  
  const value = {
    isWorldIDVerified,
    userId,
    setIsWorldIDVerified,
    setUserId,
    resetIdentity
  };
  
  // Show loading state while initializing
  if (!isInitialized) {
    return <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground">Initializing...</p>
    </div>;
  }
  
  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};

export default WalletProvider;
