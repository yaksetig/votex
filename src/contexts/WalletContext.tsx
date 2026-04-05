
import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { useToast } from "@/hooks/use-toast";
import { clearStoredCredential } from '@/services/passkeyService';
import { revokeStoredWorldIdSession, validateStoredWorldIdSession } from '@/services/worldIdSessionService';

interface WalletContextType {
  isAuthLoading: boolean;
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
  isAuthLoading: true,
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
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isWorldIDVerified, setIsWorldIDVerified] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [justVerified, setJustVerified] = useState(false);
  const [derivedPublicKey, setDerivedPublicKey] = useState<{ x: string; y: string } | null>(null);
  const { toast } = useToast();
  
  // Load identity from a server-validated session on component mount
  useEffect(() => {
    let cancelled = false;

    const restoreIdentity = async () => {
      try {
        const session = await validateStoredWorldIdSession();

        if (cancelled) {
          return;
        }

        if (session) {
          setUserId(session.userId);
          setIsWorldIDVerified(true);
          toast({
            title: "Authentication loaded",
            description: "Your human identity has been restored.",
          });
        } else {
          setUserId(null);
          setIsWorldIDVerified(false);
        }
      } catch {
        if (!cancelled) {
          setUserId(null);
          setIsWorldIDVerified(false);
        }
      } finally {
        if (!cancelled) {
          setIsAuthLoading(false);
        }
      }
    };

    void restoreIdentity();

    return () => {
      cancelled = true;
    };
  }, [toast]);
  
  // Function to reset identity (for logout)
  const resetIdentity = async () => {
    console.log('Resetting identity...');
    await revokeStoredWorldIdSession();
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
    isAuthLoading,
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
