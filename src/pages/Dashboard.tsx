
import React, { useState } from "react"
import { useWallet } from "@/contexts/WalletContext"
import { useToast } from "@/hooks/use-toast"
import WorldIDSignIn from "@/components/WorldIDSignIn"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Key, Fingerprint, Loader2, RefreshCw } from "lucide-react"
import { authenticateWithAnyPasskey } from "@/services/passkeyService"
import { deriveKeypairFromSecret, publicKeyToStrings, verifyDerivedKeypair } from "@/services/deterministicKeyService"

const Dashboard = () => {
  const { isWorldIDVerified, userId, derivedPublicKey, setDerivedPublicKey } = useWallet()
  const { toast } = useToast()
  const [isDerivingKey, setIsDerivingKey] = useState(false)

  // Re-derive keypair from passkey using discoverable credentials
  const rederiveKeypair = async () => {
    setIsDerivingKey(true)
    try {
      const prfResult = await authenticateWithAnyPasskey()
      const keypair = await deriveKeypairFromSecret(prfResult.secret)
      
      if (!verifyDerivedKeypair(keypair)) {
        throw new Error("Derived keypair verification failed")
      }
      
      const pkStrings = publicKeyToStrings(keypair.pk)
      setDerivedPublicKey(pkStrings)
      
      toast({
        title: "Keypair derived",
        description: "Your cryptographic keypair has been derived from your passkey.",
      })
    } catch (error) {
      console.error("Error deriving keypair:", error)
      toast({
        variant: "destructive",
        title: "Derivation failed",
        description: error instanceof Error ? error.message : "Failed to derive keypair",
      })
    } finally {
      setIsDerivingKey(false)
    }
  }

  // If not verified with World ID
  if (!isWorldIDVerified || !userId) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-md mx-auto">
          <h2 className="text-2xl font-bold mb-4 text-center">Welcome to Votex</h2>
          <p className="mb-6 text-center text-muted-foreground">
            Verify your identity to access elections.
          </p>
          <WorldIDSignIn />
        </div>
      </div>
    )
  }


  // Verified view with anonymous identity
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <div className="flex items-center gap-4">
          <div className="bg-crypto-green/20 text-crypto-green px-3 py-1 rounded-full text-sm">
            World ID Verified
          </div>
        </div>
      </div>
      
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Welcome!</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              Your identity is verified with World ID and bound to your passkey. 
              Your cryptographic keypair is derived on-demand and never stored.
            </p>
          </CardContent>
        </Card>

        {derivedPublicKey ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-primary" />
                  <CardTitle>Your Public Key</CardTitle>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={rederiveKeypair}
                  disabled={isDerivingKey}
                >
                  {isDerivingKey ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  <span className="ml-2">Re-derive</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3 dark:bg-amber-950/20 dark:border-amber-800">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  🔒 Your private key is derived from your passkey and exists only in memory during use. 
                  It is never stored.
                </p>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground mb-2">Public Key X</p>
                <div className="bg-muted p-3 rounded-md">
                  <code className="text-sm font-mono break-all">{derivedPublicKey.x}</code>
                </div>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground mb-2">Public Key Y</p>
                <div className="bg-muted p-3 rounded-md">
                  <code className="text-sm font-mono break-all">{derivedPublicKey.y}</code>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Fingerprint className="h-5 w-5" />
                Derive Your Keypair
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Your keypair needs to be derived from your passkey. 
                Select your passkey from the browser prompt - it works even in private browsing.
              </p>
              <Button 
                onClick={rederiveKeypair} 
                disabled={isDerivingKey}
                className="w-full"
              >
                {isDerivingKey ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deriving Keypair...
                  </>
                ) : (
                  <>
                    <Fingerprint className="mr-2 h-4 w-4" />
                    Sign in with Passkey
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default Dashboard
