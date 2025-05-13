
import React from "react";
import { useWallet } from "@/contexts/WalletContext";
import { Link } from "react-router-dom";

const NavBar = () => {
  const { isWorldIDVerified, resetIdentity } = useWallet();

  return (
    <nav className="py-4 px-6 flex items-center justify-between border-b border-border">
      <div className="flex items-center gap-2">
        <Link to="/">
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-400">
            Humanity Verifier
          </h1>
        </Link>
      </div>
      <div className="flex items-center gap-3">
        {isWorldIDVerified && (
          <>
            <div className="bg-green-500/20 text-green-500 px-3 py-1 rounded-full text-sm flex items-center">
              <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
              Verified Human
            </div>
            <button 
              onClick={resetIdentity}
              className="text-sm text-muted-foreground hover:text-destructive"
            >
              Reset
            </button>
          </>
        )}
      </div>
    </nav>
  );
};

export default NavBar;
