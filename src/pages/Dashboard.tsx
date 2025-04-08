
import React from "react";
import { useWallet } from "@/contexts/WalletContext";
import CreateElectionDialog from "@/components/CreateElectionDialog";
import ElectionsGrid from "@/components/ElectionsGrid";
import { Button } from "@/components/ui/button";

const Dashboard = () => {
  const { address, connect, isConnecting } = useWallet();

  // If not connected, show connect prompt
  if (!address) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center">
        <div className="text-center max-w-md p-6">
          <h1 className="text-4xl font-bold crypto-gradient-text mb-6">
            Crypto Vote Arena
          </h1>
          <p className="text-xl mb-8">
            Create and participate in decentralized voting with just a few clicks.
          </p>
          <button
            className="connect-button text-lg py-3 px-8"
            onClick={connect}
            disabled={isConnecting}
          >
            {isConnecting ? "Connecting..." : "Connect Wallet to Start"}
          </button>
        </div>
      </div>
    );
  }

  // Connected view
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold">Elections</h2>
        <CreateElectionDialog />
      </div>
      <ElectionsGrid />
    </div>
  );
};

export default Dashboard;
