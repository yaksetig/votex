
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from '@/components/ui/card';
import { 
  generateKeypair, 
  storeKeypair, 
  retrieveKeypair,
  getPublicKeyString,
  signWithKeypair as signMessage,
  verifySignature,
  BabyJubjubKeyPair
} from '@/services/workingBabyJubjubService';

const DebuggingTools: React.FC = () => {
  const [keypair, setKeypair] = useState<BabyJubjubKeyPair | null>(null);
  const [lastSignature, setLastSignature] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string>('Hello, anonymous voting!');
  const [logs, setLogs] = useState<string[]>([]);
  
  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()} - ${message}`]);
  };
  
  useEffect(() => {
    const checkKeypair = async () => {
      try {
        addLog("Checking for stored keypair...");
        const storedKeypair = await retrieveKeypair();
        
        if (storedKeypair) {
          setKeypair(storedKeypair);
          addLog("Found keypair. Public key: " + getPublicKeyString(storedKeypair.publicKey).substring(0, 20) + "...");
        } else {
          addLog("No keypair found in storage");
        }
      } catch (error) {
        console.error("Error retrieving keypair:", error);
        addLog("Error retrieving keypair: " + String(error));
      }
    };
    
    checkKeypair();
  }, []);
  
  const handleGenerateKeypair = async () => {
    try {
      addLog("Generating new keypair...");
      const newKeypair = await generateKeypair();
      setKeypair(newKeypair);
      addLog("Generated keypair. Public key: " + getPublicKeyString(newKeypair.publicKey).substring(0, 20) + "...");
    } catch (error) {
      console.error("Error generating keypair:", error);
      addLog("Error generating keypair: " + String(error));
    }
  };
  
  const handleSaveKeypair = async () => {
    if (!keypair) {
      addLog("No keypair to save");
      return;
    }
    
    try {
      addLog("Saving keypair to local storage...");
      storeKeypair(keypair);
      addLog("Keypair saved successfully");
    } catch (error) {
      console.error("Error saving keypair:", error);
      addLog("Error saving keypair: " + String(error));
    }
  };
  
  const handleSignMessage = async () => {
    if (!keypair) {
      addLog("No keypair available for signing");
      return;
    }
    
    try {
      addLog(`Signing message: "${message}"`);
      const signature = await signMessage(message, keypair);
      setLastSignature(signature);
      addLog("Message signed. Signature: " + signature.substring(0, 40) + "...");
    } catch (error) {
      console.error("Error signing message:", error);
      addLog("Error signing message: " + String(error));
    }
  };
  
  const handleVerifySignature = async () => {
    if (!keypair || !lastSignature) {
      addLog("No keypair or signature available for verification");
      return;
    }
    
    try {
      addLog("Verifying signature...");
      const isValid = await verifySignature(message, lastSignature, keypair.publicKey);
      setVerificationResult(isValid);
      addLog(`Signature verification result: ${isValid ? 'Valid' : 'Invalid'}`);
    } catch (error) {
      console.error("Error verifying signature:", error);
      addLog("Error verifying signature: " + String(error));
      setVerificationResult(false);
    }
  };
  
  return (
    <Card className="border-dashed border-yellow-500">
      <CardHeader>
        <CardTitle className="text-yellow-500">Debug Tools</CardTitle>
        <CardDescription>
          These tools are for debugging purposes only and should be removed in production.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateKeypair}
            >
              Generate Keypair
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveKeypair}
              disabled={!keypair}
            >
              Save Keypair
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignMessage}
              disabled={!keypair}
            >
              Sign Message
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleVerifySignature}
              disabled={!keypair || !lastSignature}
            >
              Verify Signature
            </Button>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Message to sign</label>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full p-2 border rounded text-sm"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium mb-1">Current Keypair</h4>
              {keypair ? (
                <pre className="text-xs bg-secondary/50 p-2 rounded-sm overflow-x-auto">
                  {`Public Key: ${getPublicKeyString(keypair.publicKey).substring(0, 45)}...`}
                </pre>
              ) : (
                <p className="text-xs text-muted-foreground">No keypair loaded</p>
              )}
            </div>
            
            {lastSignature && (
              <div>
                <h4 className="text-sm font-medium mb-1">Last Signature</h4>
                <pre className="text-xs bg-secondary/50 p-2 rounded-sm overflow-x-auto">
                  {lastSignature.substring(0, 45) + '...'}
                </pre>
              </div>
            )}
            
            {verificationResult !== null && (
              <div>
                <h4 className="text-sm font-medium mb-1">Verification Result</h4>
                <div className={`text-sm ${verificationResult ? 'text-green-500' : 'text-red-500'}`}>
                  {verificationResult ? 'Valid signature ✓' : 'Invalid signature ✗'}
                </div>
              </div>
            )}
          </div>
          
          <div>
            <h4 className="text-sm font-medium mb-1">Debug Log</h4>
            <div className="bg-black/70 text-green-400 p-2 rounded h-32 overflow-y-auto font-mono text-xs">
              {logs.length === 0 ? (
                <p>No logs yet</p>
              ) : (
                logs.map((log, i) => <div key={i}>{log}</div>)
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DebuggingTools;
