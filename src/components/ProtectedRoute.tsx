import React from "react";
import { Navigate } from "react-router-dom";
import { useWallet } from "@/contexts/WalletContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthLoading, isWorldIDVerified } = useWallet();

  if (isAuthLoading) {
    return (
      <div className="flex min-h-[calc(100vh-72px)] items-center justify-center px-4 py-10">
        <div className="rounded-[2rem] border border-outline-variant/15 bg-surface-container-lowest px-8 py-10 text-center shadow-ledger">
          <p className="ledger-eyebrow">Secure gateway</p>
          <h1 className="mt-3 font-headline text-3xl font-bold text-primary">
            Validating session
          </h1>
        </div>
      </div>
    );
  }

  if (!isWorldIDVerified) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
