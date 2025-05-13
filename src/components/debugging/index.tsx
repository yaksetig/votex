
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import KeypairActions from './KeypairActions';
import SignatureTools from './SignatureTools';
import LogsDisplay from './LogsDisplay';
import { 
  initBabyJubjub, 
  generateKeypair, 
  storeKeypair, 
  retrieveKeypair,
  signWithKeypair,
  verifySignature,
  BabyJubjubKeyPair
} from '@/services/babyJubjubService';

const DebuggingTools: React.FC = () => {
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
        addLog('Initializing Baby Jubjub (circomlibjs implementation)...');
        await initBabyJubjub();
        addLog('Baby Jubjub initialized successfully');
        
        // Try to retrieve stored keypair
        const stored = await retrieveKeypair();
        if (stored) {
          setStoredKeypair(stored);
          addLog('Retrieved stored keypair');
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
      setStatus('success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Generation error: ${errorMessage}`);
      addLog(`Error generating keypair: ${errorMessage}`);
      setStatus('error');
      
      // Log additional debug info
      if (err instanceof Error && err.stack) {
        console.error("Stack trace:", err.stack);
        addLog(`Stack trace: ${err.stack.split('\n')[0]}`);
      }
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
      
      const sig = await signWithKeypair(message, keypair);
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
        <CardTitle>Baby Jubjub Tester (circomlibjs implementation)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <KeypairActions
            keypair={keypair}
            storedKeypair={storedKeypair}
            status={status}
            onGenerateKeypair={handleGenerateKeypair}
            onStoreKeypair={handleStoreKeypair}
          />
          
          <SignatureTools
            message={message}
            signature={signature}
            verificationResult={verificationResult}
            keypair={keypair}
            status={status}
            onMessageChange={setMessage}
            onSignMessage={handleSignMessage}
            onVerifySignature={handleVerifySignature}
          />
        </div>
        
        <LogsDisplay logs={logs} />
      </CardContent>
    </Card>
  );
};

export default DebuggingTools;
