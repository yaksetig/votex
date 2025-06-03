
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, AlertTriangle, CheckCircle, Settings, Server, Database } from "lucide-react";
import { hasTrustedSetup, generateTrustedSetup, getTrustedSetupForElection } from "@/services/trustedSetupService";
import { useToast } from "@/hooks/use-toast";

interface Props {
  electionId: string;
  isAdmin?: boolean;
}

const TrustedSetupStatus: React.FC<Props> = ({ electionId, isAdmin = false }) => {
  const [hasSetup, setHasSetup] = useState<boolean | null>(null);
  const [setupDetails, setSetupDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkSetupStatus();
  }, [electionId]);

  const checkSetupStatus = async () => {
    try {
      setLoading(true);
      const setupExists = await hasTrustedSetup(electionId);
      setHasSetup(setupExists);
      
      if (setupExists) {
        const details = await getTrustedSetupForElection(electionId);
        setSetupDetails(details);
      }
    } catch (error) {
      console.error("Error checking trusted setup status:", error);
      setHasSetup(false);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSetup = async () => {
    try {
      setGenerating(true);
      
      // This will fail due to RLS policy, but shows the intended flow
      const success = await generateTrustedSetup(electionId, "admin-user");
      
      if (success) {
        toast({
          title: "Trusted Setup Generated",
          description: "The cryptographic trusted setup has been created for this election.",
        });
        setHasSetup(true);
        checkSetupStatus();
      } else {
        toast({
          variant: "destructive",
          title: "Setup Generation Failed",
          description: "Only authorized administrators can generate trusted setups.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate trusted setup. Admin privileges required.",
      });
    } finally {
      setGenerating(false);
    }
  };

  const isHybridSetup = setupDetails?.proving_key_filename && setupDetails?.proving_key_hash;
  const isLegacySetup = setupDetails?.proving_key && !isHybridSetup;

  if (loading) {
    return (
      <Card className="border-muted">
        <CardContent className="pt-6">
          <div className="flex items-center space-x-2">
            <Settings className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Checking setup status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`border-2 ${hasSetup ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2 text-sm">
          <Shield className="h-4 w-4" />
          <span>Cryptographic Setup</span>
          {hasSetup ? (
            <Badge variant="default" className="bg-green-100 text-green-800">
              <CheckCircle className="h-3 w-3 mr-1" />
              Ready
            </Badge>
          ) : (
            <Badge variant="destructive" className="bg-amber-100 text-amber-800">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Required
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {hasSetup ? (
          <div className="space-y-3">
            <p className="text-sm text-green-700">
              ✓ Trusted setup completed - nullification is available
            </p>
            
            {/* Setup type indicator */}
            <div className="flex items-center space-x-2 text-xs">
              {isHybridSetup ? (
                <>
                  <div className="flex items-center space-x-1 text-blue-600">
                    <Server className="h-3 w-3" />
                    <span>Proving Key: Server</span>
                  </div>
                  <div className="flex items-center space-x-1 text-purple-600">
                    <Database className="h-3 w-3" />
                    <span>Verification Key: Database</span>
                  </div>
                </>
              ) : isLegacySetup ? (
                <div className="flex items-center space-x-1 text-gray-600">
                  <Database className="h-3 w-3" />
                  <span>Legacy: All keys in database</span>
                </div>
              ) : (
                <span className="text-gray-500">Setup type unknown</span>
              )}
            </div>
            
            <p className="text-xs text-muted-foreground">
              The cryptographic parameters required for secure nullification have been generated and stored.
              {isHybridSetup && " Using hybrid storage for optimal performance."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-amber-700">
              ⚠ Trusted setup required for nullification
            </p>
            <p className="text-xs text-muted-foreground">
              A cryptographic trusted setup ceremony must be completed before voters can nullify their votes securely.
            </p>
            {isAdmin && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={handleGenerateSetup}
                disabled={generating}
                className="bg-amber-100 hover:bg-amber-200 text-amber-800 border-amber-300"
              >
                <Settings className="h-3 w-3 mr-1" />
                {generating ? "Generating..." : "Generate Setup"}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TrustedSetupStatus;
