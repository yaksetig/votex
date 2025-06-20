
import React from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, VoteIcon } from "lucide-react";
import { useEffect } from "react";

const Success: React.FC = () => {
  const navigate = useNavigate();
  const { isWorldIDVerified, userId, justVerified, setJustVerified } = useWallet();

  // Redirect to elections if not verified OR not just verified
  useEffect(() => {
    if (!isWorldIDVerified || !userId || !justVerified) {
      console.log('User not freshly verified, redirecting to elections');
      navigate("/elections", { replace: true });
    }
  }, [isWorldIDVerified, userId, justVerified, navigate]);

  // Auto-redirect to elections after showing success message
  useEffect(() => {
    if (justVerified) {
      const timer = setTimeout(() => {
        setJustVerified(false);
        navigate("/elections", { replace: true });
      }, 5000); // Show success for 5 seconds, then redirect to elections
      
      return () => clearTimeout(timer);
    }
  }, [justVerified, setJustVerified, navigate]);

  // Don't render anything if not verified (while redirecting)
  if (!isWorldIDVerified || !userId || !justVerified) {
    return null;
  }

  return (
    <div className="container mx-auto py-16 px-4 max-w-md">
      <Card className="border-green-200 shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto bg-green-100 p-3 rounded-full w-16 h-16 flex items-center justify-center mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl">Verification Successful</CardTitle>
          <CardDescription>You have successfully verified your humanity</CardDescription>
        </CardHeader>
        
        <CardContent className="text-center">
          <p className="mb-4">
            Your unique identity has been created and you can now participate in anonymous voting without revealing your personal information.
          </p>
          <div className="flex flex-col gap-2 items-center justify-center my-4">
            <span className="flex items-center justify-center gap-2 text-sm bg-green-100 text-green-700 px-3 py-1 rounded-full">
              <CheckCircle className="h-4 w-4" /> Privacy Preserved
            </span>
            <span className="flex items-center justify-center gap-2 text-sm bg-green-100 text-green-700 px-3 py-1 rounded-full">
              <CheckCircle className="h-4 w-4" /> One Person = One Vote
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            Redirecting to elections in a few seconds...
          </p>
        </CardContent>
        
        <CardFooter className="flex flex-col gap-3">
          <Button 
            className="w-full"
            onClick={() => navigate("/elections")}
          >
            <VoteIcon className="mr-2 h-4 w-4" />
            Go to Elections Now
          </Button>
          <Button 
            variant="outline"
            className="w-full"
            onClick={() => navigate("/dashboard")}
          >
            View Dashboard
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Success;
