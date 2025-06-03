
import React, { useState, useEffect } from "react"
import { useWallet } from "@/contexts/WalletContext"
import { useToast } from "@/hooks/use-toast"
import WorldIDVerifier from "@/components/WorldIDVerifier"
import { getStoredKeypair } from "@/services/keypairService"
import { StoredKeypair } from "@/types/keypair"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Eye, EyeOff, Key } from "lucide-react"

const Dashboard = () => {
  const { isWorldIDVerified, userId } = useWallet()
  const { toast } = useToast()
  const [isVerificationComplete, setIsVerificationComplete] = useState(false)
  const [keypair, setKeypair] = useState<StoredKeypair | null>(null)
  const [showPrivateKey, setShowPrivateKey] = useState(false)
  
  // Check verification status and load keypair on component mount
  useEffect(() => {
    // If already verified with a userId, show a message
    if (isWorldIDVerified && userId) {
      console.log('User already verified with ID:', userId)
      
      // Load keypair from localStorage
      const storedKeypair = getStoredKeypair()
      if (storedKeypair) {
        setKeypair(storedKeypair)
      }
    }
  }, [isWorldIDVerified, userId])

  const handleVerificationSuccess = () => {
    console.log('Verification success callback in Dashboard')
    setIsVerificationComplete(true)
    
    // Show celebration toast
    toast({
      title: "Welcome to Votex!",
      description: "You can now create and participate in anonymous elections.",
    })
  }

  const truncateKey = (key: string, showFull: boolean = false) => {
    if (showFull || key.length <= 12) return key;
    return `${key.substring(0, 6)}...${key.substring(key.length - 6)}`;
  }

  // If not verified with World ID or don't have a userId
  if (!isWorldIDVerified || !userId) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-md mx-auto bg-card p-6 rounded-lg border border-border">
          <h2 className="text-2xl font-bold mb-4">Welcome to Votex</h2>
          <p className="mb-6">
            To participate in anonymous voting, you need to verify your identity with World ID.
            This ensures one-person-one-vote while keeping your votes private.
          </p>
          <WorldIDVerifier onVerificationSuccess={handleVerificationSuccess} />
        </div>
      </div>
    )
  }

  // Show a brief transition message after verification is complete
  if (isVerificationComplete) {
    // Reset after a short delay
    setTimeout(() => setIsVerificationComplete(false), 2000)
    
    return (
      <div className="container mx-auto py-8 px-4 text-center">
        <div className="max-w-md mx-auto bg-card p-6 rounded-lg border border-border">
          <h2 className="text-2xl font-bold mb-4">Identity Created!</h2>
          <p className="mb-4">
            Your anonymous identity has been created successfully.
          </p>
          <p className="text-sm text-muted-foreground">
            Loading...
          </p>
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
              Your identity has been verified with World ID. This is a clean dashboard with all BabyJubjub and election-related code removed.
            </p>
          </CardContent>
        </Card>

        {keypair && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Key className="h-5 w-5 text-primary" />
                <CardTitle>Your Cryptographic Keypair</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Private Key</p>
                <div className="bg-muted p-3 rounded-md flex items-center justify-between">
                  <code className="text-sm font-mono flex-1">
                    {showPrivateKey ? keypair.k : "•".repeat(20)}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPrivateKey(!showPrivateKey)}
                    className="ml-2"
                  >
                    {showPrivateKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-amber-600 mt-1">Keep this secret!</p>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground mb-2">Public Key X</p>
                <div className="bg-muted p-3 rounded-md">
                  <code className="text-sm font-mono break-all">{truncateKey(keypair.Ax)}</code>
                </div>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground mb-2">Public Key Y</p>
                <div className="bg-muted p-3 rounded-md">
                  <code className="text-sm font-mono break-all">{truncateKey(keypair.Ay)}</code>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default Dashboard
