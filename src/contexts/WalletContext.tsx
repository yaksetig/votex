
import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { ethers } from 'ethers';
import { useToast } from "@/components/ui/use-toast";
import { KeyPair, retrieveKeypair } from '@/services/keyPairService';

interface WalletContextType {
  address: string | null;
  isConnecting: boolean;
  isWorldIDVerified: boolean;
  anonymousKeypair: KeyPair | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  signMessage: (message: string) => Promise<string | null>;
  setIsWorldIDVerified: (value: boolean) => void;
  setAnonymousKeypair: (keypair: KeyPair | null) => void;
}

const WalletContext = createContext<WalletContextType>({
  address: null,
  isConnecting: false,
  isWorldIDVerified: false,
  anonymousKeypair: null,
  connect: async () => {},
  disconnect: () => {},
  signMessage: async () => null,
  setIsWorldIDVerified: () => {},
  setAnonymousKeypair: () => {},
});

export const useWallet = () => useContext(WalletContext);

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isWorldIDVerified, setIsWorldIDVerified] = useState(false);
  const [anonymousKeypair, setAnonymousKeypair] = useState<KeyPair | null>(null);
  const { toast } = useToast();
  
  useEffect(() => {
    const storedKeypair = retrieveKeypair();
    if (storedKeypair) {
      setAnonymousKeypair(storedKeypair);
      setIsWorldIDVerified(true);
    }
  }, []);
  
  const connect = async () => {
    if (!window.ethereum) {
      toast({
        title: "Metamask not found",
        description: "Please install Metamask extension to use this app.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsConnecting(true);
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = provider.getSigner();
      const address = await signer.getAddress();
      setAddress(address);
      
      localStorage.setItem('wallet-connected', 'true');
      
      toast({
        title: "Wallet connected",
        description: `Connected to ${address.substring(0, 6)}...${address.substring(38)}`,
      });
    } catch (error) {
      console.error("Error connecting wallet:", error);
      toast({
        title: "Connection failed",
        description: "Failed to connect wallet. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };
  
  const disconnect = () => {
    setAddress(null);
    localStorage.removeItem('wallet-connected');
    toast({
      title: "Wallet disconnected",
      description: "Your wallet has been disconnected.",
    });
  };
  
  const signMessage = async (message: string): Promise<string | null> => {
    if (!window.ethereum || !address) return null;
    
    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const signature = await signer.signMessage(message);
      return signature;
    } catch (error) {
      console.error("Error signing message:", error);
      toast({
        title: "Signing failed",
        description: "Failed to sign message. Please try again.",
        variant: "destructive",
      });
      return null;
    }
  };
  
  useEffect(() => {
    const checkConnection = async () => {
      if (window.ethereum && localStorage.getItem('wallet-connected') === 'true') {
        await connect();
      }
    };
    
    checkConnection();
    
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnect();
      } else if (address !== accounts[0]) {
        setAddress(accounts[0]);
      }
    };
    
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
    }
    
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      }
    };
  }, []);
  
  const value = {
    address,
    isConnecting,
    isWorldIDVerified,
    anonymousKeypair,
    connect,
    disconnect,
    signMessage,
    setIsWorldIDVerified,
    setAnonymousKeypair,
  };
  
  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};
