
import React from "react";
import { useWallet } from "@/contexts/WalletContext";

const NavBar = () => {
  const { isWorldIDVerified } = useWallet();

  return (
    <nav className="py-4 px-6 flex items-center justify-between border-b border-border">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold crypto-gradient-text">Votex</h1>
      </div>
      <div>
        {isWorldIDVerified && (
          <div className="bg-crypto-green/20 text-crypto-green px-3 py-1 rounded-full text-sm">
            World ID Verified
          </div>
        )}
      </div>
    </nav>
  );
};

export default NavBar;
