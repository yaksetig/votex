
import React from 'react';
import { Button } from '@/components/ui/button';

interface SignatureToolsProps {
  message: string;
  signature: string | null;
  verificationResult: boolean | null;
  keypair: any | null;
  status: 'idle' | 'loading' | 'success' | 'error';
  onMessageChange: (message: string) => void;
  onSignMessage: () => void;
  onVerifySignature: () => void;
}

const SignatureTools: React.FC<SignatureToolsProps> = ({
  message,
  signature,
  verificationResult,
  keypair,
  status,
  onMessageChange,
  onSignMessage,
  onVerifySignature,
}) => {
  return (
    <div>
      <h3 className="text-lg font-medium mb-2">Signature Tools</h3>
      
      <div className="space-y-2">
        <div>
          <label className="block text-sm font-medium mb-1">Message to sign</label>
          <input
            type="text"
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            className="w-full p-2 border rounded text-sm"
          />
        </div>
        
        <Button 
          onClick={onSignMessage} 
          disabled={status === 'loading' || !keypair}
          className="w-full"
        >
          Sign Message
        </Button>
        
        <Button 
          onClick={onVerifySignature} 
          disabled={status === 'loading' || !keypair || !signature}
          className="w-full"
        >
          Verify Signature
        </Button>
      </div>
      
      <div className="mt-4 space-y-2 text-sm">
        {signature && (
          <div>
            <strong>Signature:</strong>{' '}
            <span className="font-mono text-xs break-all">{signature.substring(0, 50)}...</span>
          </div>
        )}
        
        {verificationResult !== null && (
          <div>
            <strong>Verification:</strong>{' '}
            <span className={verificationResult ? 'text-green-500' : 'text-red-500'}>
              {verificationResult ? 'Valid signature' : 'Invalid signature'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default SignatureTools;
