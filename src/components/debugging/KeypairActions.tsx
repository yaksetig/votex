
import React from 'react';
import { Button } from '@/components/ui/button';
import { BabyJubjubKeyPair, getPublicKeyString } from '@/services/babyJubjubService';

interface KeypairActionsProps {
  keypair: BabyJubjubKeyPair | null;
  storedKeypair: BabyJubjubKeyPair | null;
  status: 'idle' | 'loading' | 'success' | 'error';
  onGenerateKeypair: () => void;
  onStoreKeypair: () => void;
}

const KeypairActions: React.FC<KeypairActionsProps> = ({
  keypair,
  storedKeypair,
  status,
  onGenerateKeypair,
  onStoreKeypair,
}) => {
  return (
    <div>
      <h3 className="text-lg font-medium mb-2">Keypair Management</h3>
      <div className="space-y-2">
        <Button 
          onClick={onGenerateKeypair} 
          disabled={status === 'loading'}
          className="w-full"
        >
          Generate Keypair
        </Button>
        
        <Button 
          onClick={onStoreKeypair} 
          disabled={status === 'loading' || !keypair}
          className="w-full"
        >
          Store Keypair
        </Button>
      </div>
      
      <div className="mt-4 space-y-2 text-sm">
        <div>
          <strong>Generated Keypair:</strong>{' '}
          {keypair ? (
            <div className="font-mono text-xs break-all">
              <div className="mb-1">
                <span className="text-muted-foreground">Private:</span> {Buffer.from(keypair.privateKey).toString('hex').substring(0, 10)}...
              </div>
              <div>
                <span className="text-muted-foreground">Public:</span> {getPublicKeyString(keypair.publicKey).substring(0, 20)}...
              </div>
            </div>
          ) : 'None'}
        </div>
        
        <div>
          <strong>Stored Keypair:</strong>{' '}
          {storedKeypair ? (
            <div className="font-mono text-xs break-all">
              <span className="text-muted-foreground">Public:</span> {getPublicKeyString(storedKeypair.publicKey).substring(0, 20)}...
            </div>
          ) : 'None'}
        </div>
      </div>
    </div>
  );
};

export default KeypairActions;
