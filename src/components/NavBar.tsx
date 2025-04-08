
import React from "react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/contexts/WalletContext";

const NavBar = () => {
  const { address, connect, disconnect, isConnecting } = useWallet();

  return (
    <nav className="py-4 px-6 flex items-center justify-between border-b border-border">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold crypto-gradient-text">Votex</h1>
      </div>
      <div>
        {address ? (
          <div className="flex items-center gap-4">
            <div className="px-4 py-2 text-sm bg-muted rounded-lg">
              {address.substring(0, 6)}...{address.substring(38)}
            </div>
            <Button variant="outline" onClick={disconnect}>
              Disconnect
            </Button>
          </div>
        ) : (
          <button
            className="connect-button"
            onClick={connect}
            disabled={isConnecting}
          >
            {isConnecting ? "Connecting..." : "Connect Wallet"}
          </button>
        )}
      </div>
    </nav>
  );
};

export default NavBar;
