
import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { useToast } from "@/hooks/use-toast";
import { clearStoredCredential } from '@/services/passkeyService';
import { revokeStoredWorldIdSession, SESSION_STORAGE_KEY, validateStoredWorldIdSession } from '@/services/worldIdSessionService';
import { clearStoredKeypair } from '@/services/keypairService';

interface WalletContextType {
  isAuthLoading: boolean;
  isWorldIDVerified: boolean;
  userId: string | null;
  derivedPublicKey: { x: string; y: string } | null;
  setIsWorldIDVerified: (value: boolean) => void;
  setUserId: (id: string | null) => void;
  setDerivedPublicKey: (pk: { x: string; y: string } | null) => void;
  resetIdentity: () => Promise<void>;
  /** Clears local identity after the server reports an expired session and tells the voter why. */
  markSessionExpired: () => void;
}

const WalletContext = createContext<WalletContextType>({
  isAuthLoading: true,
  isWorldIDVerified: false,
  userId: null,
  derivedPublicKey: null,
  setIsWorldIDVerified: () => {},
  setUserId: () => {},
  setDerivedPublicKey: () => {},
  resetIdentity: async () => {},
  markSessionExpired: () => {},
});

// The context hook is intentionally co-located with its provider.
// eslint-disable-next-line react-refresh/only-export-components
export const useWallet = () => useContext(WalletContext);

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isWorldIDVerified, setIsWorldIDVerified] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [derivedPublicKey, setDerivedPublicKey] = useState<{ x: string; y: string } | null>(null);
  const { toast } = useToast();
  
  // Load identity from a server-validated session on component mount
  useEffect(() => {
    let cancelled = false;

    const restoreIdentity = async () => {
      let hadStoredSession = false;
      try {
        hadStoredSession = Boolean(window.localStorage.getItem(SESSION_STORAGE_KEY));
      } catch {
        hadStoredSession = false;
      }
      try {
        const session = await validateStoredWorldIdSession();

        if (cancelled) {
          return;
        }

        if (session) {
          setUserId(session.userId);
          setIsWorldIDVerified(true);
        } else {
          setUserId(null);
          setIsWorldIDVerified(false);
          if (hadStoredSession) {
            // The session was there last time; say why the voter is signed out
            // instead of silently flipping the header.
            toast({
              key: "session",
              title: "Your session expired",
              description: "Sign in again to vote, delegate or nullify.",
            });
          }
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
    // toast is a stable module-level dispatcher; run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // A logout in one tab must not leave the seed and a verified state alive in
  // another. sessionStorage is per-tab, so react to the shared localStorage
  // session key disappearing.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === SESSION_STORAGE_KEY && event.newValue === null) {
        clearStoredKeypair();
        setUserId(null);
        setIsWorldIDVerified(false);
        setDerivedPublicKey(null);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Function to reset identity (for logout)
  const resetIdentity = async () => {
    const serverRevoked = await revokeStoredWorldIdSession();
    clearStoredCredential(); // Also clear the passkey credential ID
    clearStoredKeypair();
    setUserId(null);
    setIsWorldIDVerified(false);
    setDerivedPublicKey(null);
    
    if (!serverRevoked) {
      toast({
        key: "session",
        variant: "destructive",
        title: "Signed out on this device only",
        description: "We couldn't confirm the sign-out with Votex. Sign out again when you are back online.",
      });
    }
  };

  const markSessionExpired = () => {
    clearStoredKeypair();
    setUserId(null);
    setIsWorldIDVerified(false);
    setDerivedPublicKey(null);
    toast({
      key: "session",
      title: "Your session expired",
      description: "Sign in again to continue.",
    });
  };
  
  // Expose context values
  const value = {
    isAuthLoading,
    isWorldIDVerified,
    userId,
    derivedPublicKey,
    setIsWorldIDVerified,
    setUserId,
    setDerivedPublicKey,
    resetIdentity,
    markSessionExpired,
  };
  
  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};

export default WalletProvider;
