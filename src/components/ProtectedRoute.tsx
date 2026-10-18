import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { signInPath } from "@/lib/routes";
import { useWallet } from "@/contexts/WalletContext";
import { LoadingPanel } from "@/components/LoadingPanel";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthLoading, isWorldIDVerified } = useWallet();
  const location = useLocation();

  if (isAuthLoading) {
    return <LoadingPanel label="Checking your session" />;
  }

  if (!isWorldIDVerified) {
    return <Navigate to={signInPath(location.pathname + location.search)} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
