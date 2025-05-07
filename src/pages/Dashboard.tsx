
import React from "react"
import { useWallet } from "@/contexts/WalletContext"
import CreateElectionDialog from "@/components/CreateElectionDialog"
import ElectionsGrid from "@/components/ElectionsGrid"
import WorldIDVerifier from "@/components/WorldIDVerifier"

const Dashboard = () => {
  const { isWorldIDVerified, setIsWorldIDVerified } = useWallet()

  const handleVerificationSuccess = () => {
    setIsWorldIDVerified(true)
  }

  // If not verified with World ID
  if (!isWorldIDVerified) {
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

  // Verified view with anonymous identity
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold">Elections</h2>
        <div className="flex items-center gap-4">
          <div className="bg-crypto-green/20 text-crypto-green px-3 py-1 rounded-full text-sm">
            World ID Verified
          </div>
          <CreateElectionDialog />
        </div>
      </div>
      <ElectionsGrid />
    </div>
  )
}

export default Dashboard
