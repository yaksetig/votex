
import React, { useState, useEffect } from "react"
import { useWallet } from "@/contexts/WalletContext"
import { useToast } from "@/hooks/use-toast"
import CreateElectionDialog from "@/components/CreateElectionDialog"
import ElectionsGrid from "@/components/ElectionsGrid"
import WorldIDVerifier from "@/components/WorldIDVerifier"
import DebuggingTools from "@/components/DebuggingTools"

const Dashboard = () => {
  const { isWorldIDVerified, userId } = useWallet()
  const { toast } = useToast()
  const [isVerificationComplete, setIsVerificationComplete] = useState(false)
  const [showDebugTools, setShowDebugTools] = useState(false)
  
  // Check verification status on component mount
  useEffect(() => {
    // If already verified with a userId, show a message
    if (isWorldIDVerified && userId) {
      console.log('User already verified with ID:', userId)
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
          
          {showDebugTools && (
            <>
              <div className="mt-6 pt-4 border-t border-border">
                <h3 className="text-lg font-bold mb-2">Debug Tools</h3>
                <DebuggingTools />
              </div>
            </>
          )}
          <div className="mt-6 text-center text-xs text-muted-foreground">
            Press Shift+D to toggle debug tools
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
              <div className="mt-6 pt-4 border-t border-border">
                <h3 className="text-lg font-bold mb-2">Debug Tools</h3>
                <DebuggingTools />
              </div>
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
          <div className="mt-8 pt-6 border-t border-border">
            <h3 className="text-xl font-bold mb-4">Debug Tools</h3>
            <DebuggingTools />
          </div>
        </>
      )}
      
      <div className="mt-6 text-center text-xs text-muted-foreground">
        Press Shift+D to toggle debug tools
      </div>
    </div>
  )
}

export default Dashboard
