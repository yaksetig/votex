import React, { useState, useEffect } from "react"
import { useWallet } from "@/contexts/WalletContext"
import { useToast } from "@/hooks/use-toast"
import CreateElectionDialog from "@/components/CreateElectionDialog"
import ElectionsGrid from "@/components/ElectionsGrid"
import WorldIDVerifier from "@/components/WorldIDVerifier" // Keep using the original verifier
import DebuggingTools from "@/components/DebuggingTools"
import BabyJubjubTester from "@/components/BabyJubjubTester"

const Dashboard = () => {
  const { isWorldIDVerified, anonymousKeypair } = useWallet()
  const { toast } = useToast()
  const [isVerificationComplete, setIsVerificationComplete] = useState(false)
  const [showDebugTools, setShowDebugTools] = useState(false)
  
  // Check verification status on component mount
  useEffect(() => {
    // If already verified with a keypair, show a message
    if (isWorldIDVerified && anonymousKeypair) {
      console.log('User already verified with keypair:', anonymousKeypair)
    }
    
    // Enable debug tools with special key combination (shift + D)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key === 'D') {
        console.log('Debug tools toggled')
        setShowDebugTools(prev => !prev)
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isWorldIDVerified, anonymousKeypair])

  const handleVerificationSuccess = () => {
    console.log('Verification success callback in Dashboard')
    setIsVerificationComplete(true)
    
    // Show celebration toast
    toast({
      title: "Welcome to Votex!",
      description: "You can now create and participate in anonymous elections.",
    })
  }

  // If not verified with World ID or don't have a keypair
  if (!isWorldIDVerified || !anonymousKeypair) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-md mx-auto bg-card p-6 rounded-lg border border-border">
          <h2 className="text-2xl font-bold mb-4">Welcome to Votex</h2>
          <p className="mb-6">
            To participate in anonymous voting, you need to verify your identity with World ID.
            This ensures one-person-one-vote while keeping your votes private.
          </p>
          <WorldIDVerifier onVerificationSuccess={handleVerificationSuccess} />
          
          {showDebugTools && (
            <>
              <DebuggingTools />
              <BabyJubjubTester />
            </>
          )}
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
            Loading elections...
          </p>
          
          {showDebugTools && (
            <>
              <DebuggingTools />
              <BabyJubjubTester />
            </>
          )}
        </div>
      </div>
    )
  }

  // Verified view with anonymous identity
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <h2 className="text-2xl font-bold">Elections</h2>
        <div className="flex items-center gap-4">
          <div className="bg-crypto-green/20 text-crypto-green px-3 py-1 rounded-full text-sm">
            World ID Verified
          </div>
          <CreateElectionDialog />
        </div>
      </div>
      <ElectionsGrid />
      
      {showDebugTools && (
        <>
          <DebuggingTools />
          <BabyJubjubTester />
        </>
      )}
    </div>
  )
}

export default Dashboard
