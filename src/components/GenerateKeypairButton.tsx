
import React, { useState } from "react";
import { generateKeypair } from "@/services/babyJubjubService";
import { verifyKeypairConsistency } from "@/services/elGamalService";
import { KeypairResult } from "@/types/keypair";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Lock } from "lucide-react";
import { registerKeypair } from "@/services/keypairService";

interface Props {
  onKeypairGenerated: (keypair: KeypairResult) => void;
}

const GenerateKeypairButton: React.FC<Props> = ({ onKeypairGenerated }) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const onClick = async () => {
    setLoading(true);
    try {
      console.log("Starting keypair generation with unified approach...");
      const keypair = await generateKeypair();
      
      // Store keypair in localStorage
      const storedKeypair = { 
        k: keypair.k.toString(),
        Ax: keypair.Ax.toString(),
        Ay: keypair.Ay.toString()
      };
      
      // Verify consistency between key generation approaches
      const isConsistent = verifyKeypairConsistency(storedKeypair);
      if (!isConsistent) {
        throw new Error("Generated keypair is not consistent with curve implementation!");
      }
      
      console.log("Keypair consistency verified successfully!");
      
      onKeypairGenerated(keypair);
      localStorage.setItem("babyJubKeypair", JSON.stringify(storedKeypair));
      
      // Register the keypair in the database
      const isRegistered = await registerKeypair(storedKeypair);
      
      if (isRegistered) {
        toast({
          title: "Keypair registered",
          description: "Your unique keypair has been created and registered successfully.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Registration failed",
          description: "This keypair is already registered in the system.",
        });
      }
    } catch (e: any) {
      console.error("Keypair generation failed", e);
      toast({
        variant: "destructive",
        title: "Failed to generate keypair",
        description: e.message || String(e),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button 
      onClick={onClick} 
      disabled={loading}
      className="w-full"
    >
      <Lock className="mr-2 h-4 w-4" />
      {loading ? "Generating…" : "Generate Unique Keypair"}
    </Button>
  );
};

export default GenerateKeypairButton;
