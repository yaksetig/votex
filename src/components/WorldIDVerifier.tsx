
import React, { useEffect } from 'react'
import { IDKitWidget, ISuccessResult } from '@worldcoin/idkit'
import { useWallet } from '@/contexts/WalletContext'
import { generateKeypair, storeKeypair } from '@/services/babyJubjubService'

interface WorldIDVerifierProps {
  onVerificationSuccess: () => void
}

const WorldIDVerifier: React.FC<WorldIDVerifierProps> = ({ onVerificationSuccess }) => {
  const { address, setAnonymousKeypair } = useWallet()
  
  // Initialize the Baby Jubjub library on component mount
  useEffect(() => {
    const initializeLibrary = async () => {
      // This will be handled by the generateKeypair function
    }
    initializeLibrary()
  }, [])
  
  const handleVerificationSuccess = async (result: ISuccessResult) => {
    try {
      // Generate a new Baby Jubjub keypair
      const keypair = await generateKeypair();
      
      // Store the keypair
      storeKeypair(keypair);
      
      // Update the wallet context with the keypair
      setAnonymousKeypair(keypair);
      
      // Call the success callback
      onVerificationSuccess();
      
      console.log('Verification successful with proof:', result);
    } catch (error) {
      console.error('Error during verification:', error);
    }
  }
  
  return (
    <div className="my-4">
      <h2 className="text-xl font-bold mb-2">Verify with World ID</h2>
      <p className="mb-4">Verify your identity to enable anonymous voting</p>
      
      <IDKitWidget
        app_id={import.meta.env.VITE_WORLDCOIN_APP_ID as `app_${string}`}
        action="vote_anonymously"
        signal={address || ''}
        onSuccess={handleVerificationSuccess}
        autoClose
      >
        {({ open }) => (
          <button
            onClick={open}
            className="bg-gradient-crypto px-4 py-2 rounded-lg"
          >
            Verify with World ID
          </button>
        )}
      </IDKitWidget>
    </div>
  )
}

export default WorldIDVerifier
