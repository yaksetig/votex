
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  initBabyJubjub, 
  generateKeypair, 
  storeKeypair, 
  retrieveKeypair,
  signMessage,
  verifySignature,
  getPublicKeyString,
  BabyJubjubKeyPair
} from '@/services/SimplifiedBabyJubjubService';

// This is a debugging component to test Baby Jubjub functionality
// DO NOT include this in production builds!

const BabyJubjubTester: React.FC = () => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [keypair, setKeypair] = useState<BabyJubjubKeyPair | null>(null);
  const [storedKeypair, setStoredKeypair] = useState<BabyJubjubKeyPair | null>(null);
  const [message, setMessage] = useState<string>('Hello, World!');
  const [signature, setSignature] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  // Initialize Baby Jubjub on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        addLog('Initializing Baby Jubjub...');
        await initBabyJubjub();
        addLog('Baby Jubjub initialized successfully');
        
        // Try to retrieve stored keypair
        const stored = await retrieveKeypair();
        if (stored) {
          setStoredKeypair(stored);
          addLog('Retrieved stored keypair');
          addLog(`Public key: ${getPublicKeyString(stored.publicKey)}`);
        } else {
          addLog('No stored keypair found');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(`Initialization error: ${errorMessage}`);
        addLog(`Error initializing: ${errorMessage}`);
      }
    };
    
    initialize();
  }, []);

  const handleGenerateKeypair = async () => {
    try {
      setStatus('loading');
      addLog('Generating new keypair...');
      
      const newKeypair = await generateKeypair();
      setKeypair(newKeypair);
      
      addLog('Keypair generated successfully');
      addLog(`Public key: ${getPublicKeyString(newKeypair.publicKey)}`);
      setStatus('success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Generation error: ${errorMessage}`);
      addLog(`Error generating keypair: ${errorMessage}`);
      setStatus('error');
    }
  };

  const handleStoreKeypair = async () => {
    if (!keypair) {
      setError('No keypair to store');
      return;
    }
    
    try {
      setStatus('loading');
      addLog('Storing keypair...');
      
      storeKeypair(keypair);
      
      // Verify it was stored
      const stored = await retrieveKeypair();
      setStoredKeypair(stored);
      
      addLog('Keypair stored successfully');
      setStatus('success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Storage error: ${errorMessage}`);
      addLog(`Error storing keypair: ${errorMessage}`);
      setStatus('error');
    }
  };

  const handleSignMessage = async () => {
    if (!keypair) {
      setError('No keypair to sign with');
      return;
    }
    
    try {
      setStatus('loading');
      addLog(`Signing message: "${message}"`);
      
      const sig = await signMessage(message, keypair);
      setSignature(sig);
      
      addLog('Message signed successfully');
      setStatus('success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Signing error: ${errorMessage}`);
      addLog(`Error signing message: ${errorMessage}`);
      setStatus('error');
    }
  };

  const handleVerifySignature = async () => {
    if (!keypair || !signature) {
      setError('No keypair or signature to verify');
      return;
    }
    
    try {
      setStatus('loading');
      addLog('Verifying signature...');
      
      const result = await verifySignature(message, signature, keypair.publicKey);
      setVerificationResult(result);
      
      addLog(`Signature verification result: ${result ? 'Valid' : 'Invalid'}`);
      setStatus('success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Verification error: ${errorMessage}`);
      addLog(`Error verifying signature: ${errorMessage}`);
      setStatus('error');
    }
  };

  return (
    <Card className="w-full max-w-3xl mx-auto my-8">
      <CardHeader>
        <CardTitle>Baby Jubjub Tester</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-lg font-medium mb-2">Test Actions</h3>
            <div className="space-y-2">
              <Button 
                onClick={handleGenerateKeypair} 
                disabled={status === 'loading'}
                className="w-full"
              >
                Generate Keypair
              </Button>
              
              <Button 
                onClick={handleStoreKeypair} 
                disabled={status === 'loading' || !keypair}
                className="w-full"
              >
                Store Keypair
              </Button>
              
              <div className="space-y-1">
                <input 
                  type="text" 
                  value={message} 
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full p-2 border rounded-md text-sm"
                  placeholder="Message to sign"
                />
                
                <Button 
                  onClick={handleSignMessage} 
                  disabled={status === 'loading' || !keypair}
                  className="w-full"
                >
                  Sign Message
                </Button>
              </div>
              
              <Button 
                onClick={handleVerifySignature} 
                disabled={status === 'loading' || !keypair || !signature}
                className="w-full"
              >
                Verify Signature
              </Button>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-2">Results</h3>
            
            <div className="space-y-2 text-sm">
              <div>
                <strong>Status:</strong>{' '}
                <span className={
                  status === 'success' ? 'text-green-500' : 
                  status === 'error' ? 'text-red-500' : 
                  status === 'loading' ? 'text-blue-500' : 'text-gray-500'
                }>
                  {status.toUpperCase()}
                </span>
              </div>
              
              <div>
                <strong>Generated Keypair:</strong>{' '}
                {keypair ? (
                  <span className="font-mono text-xs break-all">
                    {getPublicKeyString(keypair.publicKey)}
                  </span>
                ) : 'None'}
              </div>
              
              <div>
                <strong>Stored Keypair:</strong>{' '}
                {storedKeypair ? (
                  <span className="font-mono text-xs break-all">
                    {getPublicKeyString(storedKeypair.publicKey)}
                  </span>
                ) : 'None'}
              </div>
              
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
        </div>
        
        <div className="mt-4">
          <h3 className="text-lg font-medium mb-2">Debug Logs</h3>
          <div className="bg-black/50 p-2 rounded-md h-32 overflow-y-auto">
            {logs.map((log, i) => (
              <div key={i} className="text-xs font-mono text-gray-300">{log}</div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default BabyJubjubTester;
