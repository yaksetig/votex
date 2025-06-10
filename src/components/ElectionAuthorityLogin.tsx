
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Shield, Lock, AlertTriangle } from 'lucide-react';
import { 
  authenticateElectionAuthorityByKey, 
  createElectionAuthoritySession 
} from '@/services/electionManagementService';

interface ElectionAuthorityLoginProps {
  onLoginSuccess: (authorityId: string, authorityName: string) => void;
}

const ElectionAuthorityLogin: React.FC<ElectionAuthorityLoginProps> = ({ onLoginSuccess }) => {
  const [privateKey, setPrivateKey] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!privateKey.trim()) {
      setError('Please provide your Election Authority Private Key');
      return;
    }

    try {
      setIsAuthenticating(true);
      setError(null);

      console.log('Attempting election authority authentication...');
      
      const authResult = await authenticateElectionAuthorityByKey(privateKey.trim());

      if (authResult.success && authResult.authorityId) {
        // Create secure session
        createElectionAuthoritySession(authResult.authorityId);
        
        toast({
          title: "Authentication successful",
          description: `Welcome back, ${authResult.authorityName}!`,
        });
        
        // Clear sensitive data
        setPrivateKey('');
        
        onLoginSuccess(authResult.authorityId, authResult.authorityName || 'Election Authority');
      } else {
        setError('Authentication failed. Invalid private key.');
        toast({
          variant: "destructive",
          title: "Authentication failed",
          description: "Invalid private key or no elections found for this authority.",
        });
      }
    } catch (err) {
      console.error('Authentication error:', err);
      const errorMessage = err instanceof Error ? err.message : "Authentication failed";
      setError(errorMessage);
      
      toast({
        variant: "destructive",
        title: "Authentication error",
        description: errorMessage,
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Shield className="mx-auto h-12 w-12 text-blue-600" />
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Election Authority Access
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Secure access for election management and oversight
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-blue-600" />
              Authentication Required
            </CardTitle>
            <CardDescription>
              Enter your private key to access all elections under your authority
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  This area is restricted to authorized election authorities only. 
                  Your private key will be verified and you'll gain access to all elections under your management.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="privateKey">Election Authority Private Key</Label>
                <Input
                  id="privateKey"
                  type="password"
                  value={privateKey}
                  onChange={(e) => setPrivateKey(e.target.value)}
                  placeholder="Enter your private key..."
                  disabled={isAuthenticating}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Your private key will only be used for authentication and will not be stored.
                </p>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button 
                type="submit"
                disabled={isAuthenticating || !privateKey.trim()}
                className="w-full"
                size="lg"
              >
                {isAuthenticating ? (
                  <>
                    <Shield className="mr-2 h-4 w-4 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    Access Election Dashboard
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center">
          <p className="text-xs text-gray-500">
            Need help? Contact your election administrator for assistance.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ElectionAuthorityLogin;
