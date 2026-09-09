import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";

const Success: React.FC = () => {
  const navigate = useNavigate();
  const { isWorldIDVerified, userId, justVerified, setJustVerified } = useWallet();

  useEffect(() => {
    if (!isWorldIDVerified || !userId || !justVerified) {
      navigate("/elections", { replace: true });
      return;
    }

    const timer = setTimeout(() => {
      setJustVerified(false);
      navigate("/elections", { replace: true });
    }, 4500);

    return () => clearTimeout(timer);
  }, [isWorldIDVerified, userId, justVerified, setJustVerified, navigate]);

  if (!isWorldIDVerified || !userId || !justVerified) {
    return null;
  }

  return (
    <div className="relative flex min-h-[calc(100vh-64px)] items-center justify-center overflow-hidden px-4 py-10 sm:px-6">
      <div className="ledger-grid-glow absolute inset-0 opacity-50" />
      <div className="civic-card relative z-10 w-full max-w-md p-8 text-center sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h1 className="mt-6 font-headline text-3xl font-bold text-primary">Identity Confirmed</h1>
        <p className="mt-3 leading-relaxed text-on-surface-variant">
          World ID verification completed successfully. Your passkey-secured session is active and ready for ballot access.
        </p>
        <button
          type="button"
          onClick={() => {
            setJustVerified(false);
            navigate("/elections", { replace: true });
          }}
          className="ledger-button-primary mt-8 w-full justify-center"
        >
          Continue to Elections
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default Success;
