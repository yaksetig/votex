import React from "react";
import { Navigate } from "react-router-dom";
import { useWallet } from "@/contexts/WalletContext";
import { LoadingPanel } from "@/components/LoadingPanel";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthLoading, isWorldIDVerified } = useWallet();

  if (isAuthLoading) {
    return <LoadingPanel label="Checking your session" />;
  }

  if (!isWorldIDVerified) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
