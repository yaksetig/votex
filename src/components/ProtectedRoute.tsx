import React from "react";
import { Navigate } from "react-router-dom";
import { useWallet } from "@/contexts/WalletContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isWorldIDVerified } = useWallet();

  if (!isWorldIDVerified) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
