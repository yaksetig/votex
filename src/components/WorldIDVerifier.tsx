
import React from 'react'
import { IDKitWidget, ISuccessResult } from '@worldcoin/idkit'
import { useWallet } from '@/contexts/WalletContext'
import { generateKeypair, storeKeypair } from '@/services/keyPairService'

interface WorldIDVerifierProps {
  onVerificationSuccess: () => void
}

const WorldIDVerifier: React.FC<WorldIDVerifierProps> = ({ onVerificationSuccess }) => {
  const { address } = useWallet()
  
  const handleVerificationSuccess = async (result: ISuccessResult) => {
    try {
      // Generate a new Baby Jubjub keypair
      const keypair = await generateKeypair()
      
      // Store the keypair
      storeKeypair(keypair)
      
      // Call the success callback
      onVerificationSuccess()
    } catch (error) {
      console.error('Error during verification:', error)
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
