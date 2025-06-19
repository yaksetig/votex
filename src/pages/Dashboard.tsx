import React, { useState, useEffect } from "react"
import { useWallet } from "@/contexts/WalletContext"
import { useToast } from "@/hooks/use-toast"
import WorldIDVerifier from "@/components/WorldIDVerifier"
import GenerateKeypairButton from "@/components/GenerateKeypairButton"
import { getStoredKeypair } from "@/services/keypairService"
import { verifyKeypairConsistency } from "@/services/elGamalService"
import { StoredKeypair, KeypairResult } from "@/types/keypair"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Eye, EyeOff, Key, AlertTriangle, RefreshCw } from "lucide-react"

const Dashboard = () => {
  const { isWorldIDVerified, userId } = useWallet()
  const { toast } = useToast()
  const [isVerificationComplete, setIsVerificationComplete] = useState(false)
  const [keypair, setKeypair] = useState<StoredKeypair | null>(null)
  const [showPrivateKey, setShowPrivateKey] = useState(false)
  const [keypairValid, setKeypairValid] = useState<boolean | null>(null)
  
  // Check verification status and load keypair on component mount
  useEffect(() => {
    console.log('Dashboard useEffect - isWorldIDVerified:', isWorldIDVerified, 'userId:', userId)
    
    // If already verified with a userId, show a message
    if (isWorldIDVerified && userId) {
      console.log('User already verified with ID:', userId)
      
      // Load keypair from localStorage
      const storedKeypair = getStoredKeypair()
      console.log('Stored keypair from localStorage:', storedKeypair)
      
      if (storedKeypair) {
        console.log('Setting keypair state with:', storedKeypair)
        setKeypair(storedKeypair)
        
        // Verify the loaded keypair consistency
        const isValid = verifyKeypairConsistency(storedKeypair)
        setKeypairValid(isValid)
        
        if (!isValid) {
          console.warn("Loaded keypair failed consistency check!")
          toast({
            variant: "destructive",
            title: "Keypair inconsistency detected",
            description: "Your stored keypair may be from an old implementation. Consider generating a new one.",
          })
        }
      } else {
        console.log('No keypair found in localStorage')
      }
    }
  }, [isWorldIDVerified, userId, toast])

  const handleVerificationSuccess = () => {
    console.log('Verification success callback in Dashboard')
    setIsVerificationComplete(true)
    
    // Show celebration toast
    toast({
      title: "Welcome to Votex!",
      description: "You can now create and participate in anonymous elections.",
    })
  }

  const handleKeypairGenerated = (newKeypair: KeypairResult) => {
    console.log('Keypair generated in Dashboard:', newKeypair)
    // Convert to StoredKeypair format
    const storedKeypair: StoredKeypair = {
      k: newKeypair.k.toString(),
      Ax: newKeypair.Ax.toString(),
      Ay: newKeypair.Ay.toString()
    }
    setKeypair(storedKeypair)
    setKeypairValid(true) // New keypairs are always valid
    
    toast({
      title: "New keypair generated",
      description: "Your cryptographic keypair has been updated successfully.",
    })
  }

  const truncateKey = (key: string, showFull: boolean = false) => {
    if (showFull || key.length <= 12) return key;
    return `${key.substring(0, 6)}...${key.substring(key.length - 6)}`;
  }

  // If not verified with World ID or don't have a userId
  if (!isWorldIDVerified || !userId) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="container mx-auto py-8 px-4">
          <div className="max-w-md mx-auto bg-slate-800 p-6 rounded-lg border border-slate-700">
            <h2 className="text-2xl font-bold mb-4 text-white">Welcome to Votex</h2>
            <p className="mb-6 text-slate-300">
              To participate in anonymous voting, you need to verify your identity with World ID.
              This ensures one-person-one-vote while keeping your votes private.
            </p>
            <WorldIDVerifier onVerificationSuccess={handleVerificationSuccess} />
          </div>
        </div>
      </div>
    )
  }

  // Show a brief transition message after verification is complete
  if (isVerificationComplete) {
    // Reset after a short delay
    setTimeout(() => setIsVerificationComplete(false), 2000)
    
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="container mx-auto py-8 px-4 text-center">
          <div className="max-w-md mx-auto bg-slate-800 p-6 rounded-lg border border-slate-700">
            <h2 className="text-2xl font-bold mb-4 text-white">Identity Created!</h2>
            <p className="mb-4 text-slate-300">
              Your anonymous identity has been created successfully.
            </p>
            <p className="text-sm text-slate-400">
              Loading...
            </p>
          </div>
        </div>
      </div>
    )
  }

  console.log('Rendering dashboard with keypair:', keypair)

  // Verified view with anonymous identity
  return (
    <div className="min-h-screen bg-slate-900">
      <div className="container mx-auto py-8 px-4">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <h2 className="text-2xl font-bold text-white">Dashboard</h2>
          <div className="flex items-center gap-4">
            <div className="bg-green-900/50 text-green-300 px-3 py-1 rounded-full text-sm border border-green-800">
              World ID Verified
            </div>
          </div>
        </div>
        
        <div className="grid gap-6">
          <Card className="border-slate-700 bg-slate-800">
            <CardHeader>
              <CardTitle className="text-white">Welcome!</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-300">
                Your identity has been verified with World ID. Your keypair now uses a unified BabyJubJub implementation that's consistent with ZK proofs.
              </p>
            </CardContent>
          </Card>

          {keypair ? (
            <Card className="border-slate-700 bg-slate-800">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="h-5 w-5 text-purple-400" />
                    <CardTitle className="text-white">Your Cryptographic Keypair</CardTitle>
                    {keypairValid === false && (
                      <AlertTriangle className="h-5 w-5 text-amber-400" />
                    )}
                  </div>
                  <GenerateKeypairButton 
                    onKeypairGenerated={handleKeypairGenerated}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {keypairValid === false && (
                  <div className="bg-amber-900/20 border border-amber-800 rounded-md p-3">
                    <p className="text-sm text-amber-300">
                      ⚠️ This keypair was generated with an older implementation and may not work with ZK proofs. 
                      Consider generating a new keypair.
                    </p>
                  </div>
                )}
                
                <div>
                  <p className="text-sm text-slate-400 mb-2">Private Key</p>
                  <div className="bg-slate-700 p-3 rounded-md flex items-center justify-between">
                    <code className="text-sm font-mono flex-1 break-all text-slate-200">
                      {showPrivateKey ? keypair.k : "•".repeat(20)}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPrivateKey(!showPrivateKey)}
                      className="ml-2 text-slate-300 hover:text-white"
                    >
                      {showPrivateKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-amber-400 mt-1">Keep this secret!</p>
                </div>
                
                <div>
                  <p className="text-sm text-slate-400 mb-2">Public Key X</p>
                  <div className="bg-slate-700 p-3 rounded-md">
                    <code className="text-sm font-mono break-all text-slate-200">{keypair.Ax}</code>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm text-slate-400 mb-2">Public Key Y</p>
                  <div className="bg-slate-700 p-3 rounded-md">
                    <code className="text-sm font-mono break-all text-slate-200">{keypair.Ay}</code>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-slate-700 bg-slate-800">
              <CardHeader>
                <CardTitle className="text-white">No Keypair Found</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-300">
                  No cryptographic keypair was found in your browser's storage. Generate one to participate in anonymous voting.
                </p>
                <GenerateKeypairButton onKeypairGenerated={handleKeypairGenerated} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
