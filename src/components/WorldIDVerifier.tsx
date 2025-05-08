
import React, { useState } from 'react'
import { IDKitWidget, ISuccessResult, VerificationLevel } from '@worldcoin/idkit'
import { useWallet } from '@/contexts/WalletContext'
import { createKeypairFromWorldIDProof, storeKeypair } from '@/services/babyJubjubService'
import { useToast } from '@/hooks/use-toast'

interface WorldIDVerifierProps {
  onVerificationSuccess: () => void
}

const WorldIDVerifier: React.FC<WorldIDVerifierProps> = ({ onVerificationSuccess }) => {
  const { setAnonymousKeypair, setIsWorldIDVerified } = useWallet()
  const { toast } = useToast()
  const [isVerifying, setIsVerifying] = useState(false)
  
  const handleVerificationSuccess = async (result: ISuccessResult) => {
    try {
      setIsVerifying(true)
      console.log('Starting verification success handler')
      
      // Generate a new Baby Jubjub keypair for anonymous identity
      console.log('Generating keypair...')
      const keypair = await createKeypairFromWorldIDProof(result)
      console.log('Keypair generated successfully')
      
      // Store the keypair securely
      console.log('Storing keypair...')
      storeKeypair(keypair)
      
      // Update the wallet context with the keypair
      console.log('Updating context...')
      setAnonymousKeypair(keypair)
      setIsWorldIDVerified(true)
      
      // Show success toast
      toast({
        title: "Verification successful",
        description: "Your anonymous identity has been created.",
      })
      
      // Call the success callback
      console.log('Calling success callback...')
      onVerificationSuccess()
      
      console.log('Verification success handler completed')
    } catch (error) {
      console.error('Error during verification:', error)
      toast({
        title: "Verification failed",
        description: "Could not create your anonymous identity. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsVerifying(false)
    }
  }
  
  return (
    <div className="my-4">
      <h2 className="text-xl font-bold mb-2">Verify with World ID</h2>
      <p className="mb-4">Verify your identity to enable anonymous voting</p>
      
      {isVerifying ? (
        <div className="bg-gradient-crypto px-4 py-2 rounded-lg opacity-70 cursor-not-allowed">
          Generating your anonymous identity...
        </div>
      ) : (
        <IDKitWidget
          app_id="app_e2fd2f8c99430ab200a093278e801c57"
          action="registration"
          onSuccess={handleVerificationSuccess}
          verification_level={VerificationLevel.Orb} // Require high security
          autoClose
        >
          {({ open }) => (
            <button
              onClick={open}
              className="bg-gradient-crypto px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
            >
              Verify with World ID
            </button>
          )}
        </IDKitWidget>
      )}
    </div>
  )
}

export default WorldIDVerifier
