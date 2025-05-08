
import React, { useState } from 'react';
import { useWallet } from '@/contexts/WalletContext';
import { generateKeypair, storeKeypair, getPublicKeyString } from '@/services/SimplifiedBabyJubjubService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';

/**
 * This component provides debugging tools for the Votex application.
 * It helps troubleshoot issues with WorldID verification and Baby Jubjub keypair generation.
 * 
 * IMPORTANT: This component should NOT be included in production builds!
 */
const DebuggingTools: React.FC = () => {
  const { 
    isWorldIDVerified, 
    anonymousKeypair, 
    setIsWorldIDVerified, 
    setAnonymousKeypair,
    resetIdentity,
    refreshKeypair
  } = useWallet();
  
  const [isGenerating, setIsGenerating] = useState(false);

  const generateAndStoreKeypair = async () => {
    try {
      setIsGenerating(true);
      
      // Generate new keypair
      const keypair = await generateKeypair();
      console.log('Debug: Generated keypair:', keypair);
      
      // Store in localStorage
      storeKeypair(keypair);
      console.log('Debug: Stored keypair in localStorage');
      
      // Update context
      setAnonymousKeypair(keypair);
      setIsWorldIDVerified(true);
      console.log('Debug: Updated wallet context');
      
      toast({
        title: "Debug: Keypair generated",
        description: "Created and stored a new Baby Jubjub keypair",
      });
    } catch (error) {
      console.error('Debug: Error generating keypair:', error);
      toast({
        title: "Debug: Error",
        description: "Failed to generate keypair",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="w-full max-w-lg mx-auto my-8 bg-yellow-900/20 border-yellow-600">
      <CardHeader>
        <CardTitle className="text-yellow-400">⚠️ Debug Tools</CardTitle>
        <CardDescription>Troubleshooting tools for development only</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="font-medium">World ID Verified:</div>
          <div>{isWorldIDVerified ? '✅ Yes' : '❌ No'}</div>
          
          <div className="font-medium">Anonymous Keypair:</div>
          <div>{anonymousKeypair ? '✅ Present' : '❌ Missing'}</div>
          
          {anonymousKeypair && (
            <>
              <div className="font-medium">Public Key:</div>
              <div className="truncate text-xs">
                {getPublicKeyString(anonymousKeypair.publicKey)}
              </div>
            </>
          )}
        </div>
        
        <div className="p-2 bg-black/50 rounded text-xs overflow-auto max-h-32">
          <pre>
            {JSON.stringify({
              isWorldIDVerified,
              anonymousKeypair: anonymousKeypair 
                ? {
                    publicKey: getPublicKeyString(anonymousKeypair.publicKey),
                    privateKey: '[REDACTED]'
                  } 
                : null,
              localStorage: localStorage.getItem('anonymous-keypair') 
                ? '[PRESENT]' 
                : '[MISSING]'
            }, null, 2)}
          </pre>
        </div>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        <Button 
          variant="outline" 
          onClick={generateAndStoreKeypair}
          disabled={isGenerating}
        >
          {isGenerating ? 'Generating...' : 'Generate Test Keypair'}
        </Button>
        
        <Button 
          variant="outline" 
          onClick={() => {
            setIsWorldIDVerified(true);
            toast({
              title: "Debug: State changed",
              description: "Set WorldID verified to true",
            });
          }}
        >
          Set WorldID Verified
        </Button>
        
        <Button 
          variant="outline" 
          onClick={async () => {
            await refreshKeypair();
            toast({
              title: "Debug: Refreshed",
              description: "Refreshed keypair from storage",
            });
          }}
        >
          Refresh from Storage
        </Button>
        
        <Button 
          variant="destructive" 
          onClick={resetIdentity}
        >
          Reset Identity
        </Button>
      </CardFooter>
    </Card>
  );
};

export default DebuggingTools;
