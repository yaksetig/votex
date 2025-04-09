
import React from "react"
import { useWallet } from "@/contexts/WalletContext"
import CreateElectionDialog from "@/components/CreateElectionDialog"
import ElectionsGrid from "@/components/ElectionsGrid"
import WorldIDVerifier from "@/components/WorldIDVerifier"

const Dashboard = () => {
  const { address, connect, isConnecting, isWorldIDVerified, setIsWorldIDVerified } = useWallet()

  const handleVerificationSuccess = () => {
    setIsWorldIDVerified(true)
  }

  // If not connected, show connect prompt
  if (!address) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center">
        <div className="text-center max-w-md p-6">
          <h1 className="text-4xl font-bold crypto-gradient-text mb-6">
            Votex
          </h1>
          <p className="text-xl mb-8">
            Create and participate in decentralized voting with just a few clicks.
          </p>
          <button
            className="connect-button text-lg py-3 px-8"
            onClick={connect}
            disabled={isConnecting}
          >
            {isConnecting ? "Connecting..." : "Connect Wallet to Start"}
          </button>
        </div>
      </div>
    )
  }

  // Connected but not verified with World ID
  if (!isWorldIDVerified) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-md mx-auto bg-card p-6 rounded-lg border border-border">
          <h2 className="text-2xl font-bold mb-4">Verify Your Identity</h2>
          <p className="mb-6">
            To participate in anonymous voting, you need to verify your identity with World ID.
            This ensures one-person-one-vote while keeping your votes private.
          </p>
          <WorldIDVerifier onVerificationSuccess={handleVerificationSuccess} />
        </div>
      </div>
    )
  }

  // Connected and verified view
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
