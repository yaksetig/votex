
import React from "react";
import { StoredKeypair } from "@/types/keypair";
import { KeyRound, Shield } from "lucide-react";

interface KeypairDisplayProps {
  keypair: StoredKeypair;
}

const KeypairDisplay: React.FC<KeypairDisplayProps> = ({ keypair }) => {
  const truncateKey = (key: string) => {
    if (key.length <= 12) return key;
    return `${key.substring(0, 6)}...${key.substring(key.length - 6)}`;
  };

  return (
    <div className="bg-card p-6 rounded-lg shadow-sm border border-border">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="h-5 w-5 text-primary" />
        <h3 className="font-medium text-lg">Your Cryptographic Keypair</h3>
      </div>
      
      <div className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground mb-1">Private Key</p>
          <div className="bg-muted p-2 rounded flex items-center">
            <KeyRound className="h-4 w-4 text-amber-500 mr-2" />
            <code className="text-sm font-mono">{truncateKey(keypair.k)}</code>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Keep this secret!</p>
        </div>
        
        <div>
          <p className="text-sm text-muted-foreground mb-1">Public Key X</p>
          <div className="bg-muted p-2 rounded">
            <code className="text-sm font-mono">{truncateKey(keypair.Ax)}</code>
          </div>
        </div>
        
        <div>
          <p className="text-sm text-muted-foreground mb-1">Public Key Y</p>
          <div className="bg-muted p-2 rounded">
            <code className="text-sm font-mono">{truncateKey(keypair.Ay)}</code>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KeypairDisplay;
