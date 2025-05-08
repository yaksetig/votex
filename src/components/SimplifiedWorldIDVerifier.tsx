
import React, { useState } from 'react'
import { IDKitWidget, ISuccessResult, VerificationLevel } from '@worldcoin/idkit'
import { useWallet } from '@/contexts/WalletContext'
import { 
  generateKeypair, 
  storeKeypair, 
  getPublicKeyString 
} from '@/services/ffjavascriptBabyJubjubService'
import { useToast } from '@/hooks/use-toast'

interface WorldIDVerifierProps {
  onVerificationSuccess: () => void
}

const WorldIDVerifier: React.FC<WorldIDVerifierProps> = ({ onVerificationSuccess }) => {
  const { setAnonymousKeypair, setIsWorldIDVerified } = useWallet()
  const { toast } = useToast()
  const [isVerifying, setIsVerifying] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  
  const handleVerificationSuccess = async (result: ISuccessResult) => {
    try {
      setIsVerifying(true)
      setErrorMessage(null)
      console.log('Starting verification success handler')
      
      // Make sure World ID verification was successful
      if (!result || !result.merkle_root || !result.nullifier_hash) {
        throw new Error("Invalid World ID verification result");
      }
      
      console.log('World ID verification successful, generating keypair...')
      
      // Generate a new Baby Jubjub keypair for anonymous identity
      const keypair = await generateKeypair()
      console.log('Keypair generated successfully:')
      console.log('- PrivateKey:', keypair.privateKey.substring(0, 8) + '...')
      console.log('- PublicKey:', getPublicKeyString(keypair.publicKey).substring(0, 30) + '...')
      
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
    } catch (err) {
      let errorMessage = "Unknown error occurred during verification";
      
      if (err instanceof Error) {
        errorMessage = err.message;
        console.error('Error stack:', err.stack);
      }
      
      console.error('Error during verification:', err)
      setErrorMessage(errorMessage)
      
      toast({
        title: "Verification failed",
        description: "Could not create your anonymous identity. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsVerifying(false)
    }
  }
  
  // Test function - remove in production
  const handleTestVerification = async () => {
    try {
      setIsVerifying(true)
      setErrorMessage(null)
      console.log('Starting test verification')
      
      // Generate a fake result that mimics the World ID verification result
      const mockResult = {
        merkle_root: "0x1234567890abcdef",
        nullifier_hash: "0xabcdef1234567890",
        proof: "0x12345"
      } as ISuccessResult;
      
      // Call the real handler with the mock result
      await handleVerificationSuccess(mockResult);
    } catch (err) {
      console.error('Error during test verification:', err)
      
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Unknown error occurred during test verification");
      }
    } finally {
      setIsVerifying(false)
    }
  }
  
  return (
    <div className="my-4">
      <h2 className="text-xl font-bold mb-2">Verify with World ID</h2>
      <p className="mb-4">Verify your identity to enable anonymous voting</p>
      
      {errorMessage && (
        <div className="mb-4 p-3 bg-destructive/20 border border-destructive/50 rounded-md text-sm">
          <p className="font-medium">Error occurred:</p>
          <p>{errorMessage}</p>
        </div>
      )}
      
      {isVerifying ? (
        <div className="bg-gradient-crypto px-4 py-2 rounded-lg opacity-70 cursor-not-allowed flex items-center justify-center space-x-2">
          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Generating your anonymous identity...</span>
        </div>
      ) : (
        <>
          <IDKitWidget
            app_id="app_e2fd2f8c99430ab200a093278e801c57"
            action="registration"
            onSuccess={handleVerificationSuccess}
            verification_level={VerificationLevel.Orb}
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
          
          {/* Test button - remove in production */}
          <button
            onClick={handleTestVerification}
            className="ml-2 px-4 py-2 border border-dashed border-muted-foreground/50 rounded-lg text-muted-foreground text-sm hover:bg-muted hover:text-foreground transition-colors"
          >
            Test Keypair Generation
          </button>
        </>
      )}
    </div>
  )
}

export default WorldIDVerifier
