
import React, { useState } from "react";
import { generateKeypair } from "@/services/babyJubjubService";
import { KeypairResult } from "@/types/keypair";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Lock } from "lucide-react";

interface Props {
  onKeypairGenerated: (keypair: KeypairResult) => void;
}

const GenerateKeypairButton: React.FC<Props> = ({ onKeypairGenerated }) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const onClick = async () => {
    setLoading(true);
    try {
      const keypair = await generateKeypair();
      onKeypairGenerated(keypair);
      
      // Store keypair in localStorage
      localStorage.setItem("babyJubKeypair", JSON.stringify({ 
        k: keypair.k.toString(),
        Ax: keypair.Ax.toString(),
        Ay: keypair.Ay.toString()
      }));
      
      toast({
        title: "Keypair generated",
        description: "Your unique keypair has been created and stored securely.",
      });
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
