
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { processElectionTally, ElectionTallyResult } from '@/services/tallyService';
import { Shield, Lock, Calculator, CheckCircle, AlertTriangle } from 'lucide-react';

interface ElectionAuthorityInterfaceProps {
  electionId: string;
  electionTitle: string;
  onTallyComplete?: (results: ElectionTallyResult) => void;
}

const ElectionAuthorityInterface: React.FC<ElectionAuthorityInterfaceProps> = ({
  electionId,
  electionTitle,
  onTallyComplete = () => {}
}) => {
  const [privateKey, setPrivateKey] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [tallyResults, setTallyResults] = useState<ElectionTallyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleProcessTally = async () => {
    if (!privateKey.trim()) {
      setError('Please enter the authority private key');
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);
      
      console.log(`Processing tally for election: ${electionId}`);
      
      const results = await processElectionTally(
        electionId, 
        privateKey.trim(),
        'Election Authority' // Could be made dynamic
      );
      
      if (results) {
        setTallyResults(results);
        onTallyComplete(results);
        
        toast({
          title: "Tally processed successfully",
          description: `Processed ${results.results.length} voter records.`,
        });
      } else {
        throw new Error("Failed to process election tally");
      }
    } catch (err) {
      console.error('Error processing tally:', err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      
      toast({
        variant: "destructive",
        title: "Tally processing failed",
        description: errorMessage,
      });
    } finally {
      setIsProcessing(false);
      // Clear private key for security
      setPrivateKey('');
    }
  };

  const getTallyStats = () => {
    if (!tallyResults) return null;
    
    const totalVoters = tallyResults.results.length;
    const nullifiedVotes = tallyResults.results.filter(r => r.voteNullified).length;
    const totalNullifications = tallyResults.results.reduce((sum, r) => sum + r.nullificationCount, 0);
    
    return { totalVoters, nullifiedVotes, totalNullifications };
  };

  const stats = getTallyStats();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Election Authority Interface
          </CardTitle>
          <CardDescription>
            Process the final tally for "{electionTitle}" by decrypting nullification counts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!tallyResults && (
            <>
              <Alert>
                <Lock className="h-4 w-4" />
                <AlertDescription>
                  Enter the election authority's private key to decrypt and process nullification data. 
                  The private key will only be used locally in your browser and will not be stored.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2">
                <Label htmlFor="privateKey">Authority Private Key</Label>
                <Input
                  id="privateKey"
                  type="password"
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                  placeholder="Enter the election authority private key..."
                  disabled={isProcessing}
                />
              </div>
              
              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <Button 
                onClick={handleProcessTally}
                disabled={isProcessing || !privateKey.trim()}
                className="w-full"
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <Calculator className="mr-2 h-4 w-4 animate-spin" />
                    Processing Tally...
                  </>
                ) : (
                  <>
                    <Calculator className="mr-2 h-4 w-4" />
                    Process Election Tally
                  </>
                )}
              </Button>
            </>
          )}
          
          {tallyResults && stats && (
            <div className="space-y-4">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Tally processing completed successfully on {new Date(tallyResults.processedAt).toLocaleString()}
                </AlertDescription>
              </Alert>
              
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{stats.totalVoters}</div>
                      <div className="text-sm text-muted-foreground">Total Voters</div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{stats.nullifiedVotes}</div>
                      <div className="text-sm text-muted-foreground">Nullified Votes</div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-600">{stats.totalNullifications}</div>
                      <div className="text-sm text-muted-foreground">Total Nullifications</div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              <Button 
                onClick={() => {
                  setTallyResults(null);
                  setError(null);
                }}
                variant="outline"
                className="w-full"
              >
                Process Another Tally
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ElectionAuthorityInterface;
