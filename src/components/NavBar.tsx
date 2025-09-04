
import React from "react";
import { useWallet } from "@/contexts/WalletContext";
import { Link, useLocation } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearElectionAuthoritySession } from "@/services/electionManagementService";
import { useToast } from "@/hooks/use-toast";

const NavBar = () => {
  const { isWorldIDVerified, resetIdentity } = useWallet();
  const location = useLocation();
  const isElectionAuthorityPage = location.pathname.includes('election_authority');
  const { toast } = useToast();

  const handleElectionAuthorityLogout = () => {
    clearElectionAuthoritySession();
    toast({
      title: "Logged out",
      description: "You have been securely logged out.",
    });
    window.location.reload(); // Refresh to reset the page state
  };

  return (
    <nav className="py-4 px-6 flex items-center justify-between border-b border-border">
      <div className="flex items-center gap-2">
        <Link to="/">
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-400">
            Votex
          </h1>
        </Link>
      </div>
      <div className="flex items-center gap-4">
        {isWorldIDVerified && !isElectionAuthorityPage && (
          <>
            <Link to="/dashboard" className="text-sm hover:text-primary transition-colors">
              Dashboard
            </Link>
            <Link to="/elections" className="text-sm hover:text-primary transition-colors">
              Elections
            </Link>
          </>
        )}
        {isElectionAuthorityPage ? (
          <Button onClick={handleElectionAuthorityLogout} variant="outline" size="sm">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        ) : (
          isWorldIDVerified && (
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
                Sign out
              </button>
            </>
          )
        )}
      </div>
    </nav>
  );
};

export default NavBar;
