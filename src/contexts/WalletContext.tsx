import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
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
  const { toast } = useToast();
  
  // Load identity from storage on component mount
  useEffect(() => {
    // Check if we have a stored user ID
    const storedUserId = localStorage.getItem('worldid-user');
    
    if (storedUserId) {
      console.log('User ID loaded from storage:', storedUserId);
      setUserId(storedUserId);
      setIsWorldIDVerified(true);
      
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
    setUserId(null);
    setIsWorldIDVerified(false);
    
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
    setIsWorldIDVerified,
    setUserId,
    resetIdentity
  };
  
  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};

export default WalletProvider;
