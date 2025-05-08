
import React from 'react'
import { IDKitWidget, ISuccessResult, VerificationLevel } from '@worldcoin/idkit'
import { useWallet } from '@/contexts/WalletContext'
import { generateKeypair, storeKeypair } from '@/services/babyJubjubService'

interface WorldIDVerifierProps {
  onVerificationSuccess: () => void
}

const WorldIDVerifier: React.FC<WorldIDVerifierProps> = ({ onVerificationSuccess }) => {
  const { setVerifiedWithKeypair } = useWallet()
  
  const handleVerificationSuccess = async (result: ISuccessResult) => {
    try {
      // Generate a new Baby Jubjub keypair for anonymous identity
      const keypair = await generateKeypair();
      
      // Store the keypair securely
      storeKeypair(keypair);
      
      // Update the wallet context with the keypair
      setVerifiedWithKeypair(keypair);
      
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
        app_id="app_e2fd2f8c99430ab200a093278e801c57"
        action="registration"
        onSuccess={handleVerificationSuccess}
        verification_level={VerificationLevel.Orb} // Require high security
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
