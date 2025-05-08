
import React, { useState, useCallback, ReactNode } from "react"
import { ElectionContext } from "@/contexts/ElectionContext"
import { useWallet } from "@/contexts/WalletContext"
import { useToast } from "@/hooks/use-toast"
import { Election } from "@/types/election"
import { useRealtimeSubscriptions } from "@/hooks/useRealtimeSubscriptions"
import { 
  fetchElectionsAndVotes, 
  createElectionInDb, 
  castVoteInDb,
} from "@/utils/electionDataService"
import { userHasVoted as checkUserHasVoted, getVoteCount as calculateVoteCount } from "@/utils/voteUtils"
import { signMessage, getPublicKeyString, generateNullifier } from "@/services/SimplifiedBabyJubjubService"

interface ElectionProviderProps {
  children: ReactNode
}

export const ElectionProvider: React.FC<ElectionProviderProps> = ({ children }) => {
  const [elections, setElections] = useState<Election[]>([])
  const [loading, setLoading] = useState(true)
  const { isWorldIDVerified, anonymousKeypair } = useWallet()
  const { toast } = useToast()

  const loadElections = useCallback(async () => {
    try {
      setLoading(true)
      const data = await fetchElectionsAndVotes()
      console.log(`Loaded ${data.length} elections from database`)
      setElections(data)
    } catch (error) {
      console.error("Error fetching elections:", error)
      toast({
        title: "Error fetching elections",
        description: "Could not load elections. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  // Set up realtime subscriptions - adjusted to use void return type
  useRealtimeSubscriptions(async () => {
    await loadElections();
  });

  const createElection = async (title: string, description: string, endDate: Date, option1: string, option2: string) => {
    if (!isWorldIDVerified) {
      toast({
        title: "Verification required",
        description: "Please verify your identity with World ID to create an election.",
        variant: "destructive",
      })
      return
    }

    try {
      // We'll use the anonymous identity as the creator
      const creatorId = anonymousKeypair ? getPublicKeyString(anonymousKeypair.publicKey) : "anonymous"
      await createElectionInDb(title, description, creatorId, endDate, option1, option2)
      
      toast({
        title: "Election created",
        description: `"${title}" has been created successfully.`,
      })
      
      await loadElections()
    } catch (error) {
      console.error("Error creating election:", error)
      toast({
        title: "Error creating election",
        description: "Could not create the election. Please try again.",
        variant: "destructive",
      })
    }
  }

  const castVote = async (electionId: string, choice: string): Promise<boolean> => {
    if (!isWorldIDVerified || !anonymousKeypair) {
      toast({
        title: "World ID verification required",
        description: "Please verify with World ID to vote anonymously.",
        variant: "destructive",
      })
      return false
    }

    const election = elections.find((e) => e.id === electionId)
    if (!election) {
      toast({
        title: "Election not found",
        description: "Could not find the specified election.",
        variant: "destructive",
      })
      return false
    }

    if (election.endDate < new Date()) {
      toast({
        title: "Election ended",
        description: "This election has already ended.",
        variant: "destructive",
      })
      return false
    }

    const hasVoted = await userHasVoted(electionId)
    if (hasVoted) {
      toast({
        title: "Already voted",
        description: "You have already cast a vote in this election.",
        variant: "destructive",
      })
      return false
    }

    try {
      const message = `Vote ${choice} on Election: ${election.id}`
      
      // Sign with Baby Jubjub keypair
      const anonymousSignature = await signMessage(message, anonymousKeypair)
      
      // Generate nullifier to prevent double voting
      const nullifier = await generateNullifier(electionId, anonymousKeypair)
      
      // Get public key as string for storage
      const voterPublicKey = getPublicKeyString(anonymousKeypair.publicKey)
      
      // Submit vote to the database
      await castVoteInDb(
        electionId, 
        voterPublicKey,
        choice, 
        anonymousSignature,
        nullifier
      )

      toast({
        title: "Vote cast",
        description: `You have successfully voted "${choice}" in "${election.title}".`,
      })

      await refreshElections()
      return true
    } catch (error) {
      console.error("Error casting vote:", error)
      toast({
        title: "Error casting vote",
        description: "Could not cast your vote. Please try again.",
        variant: "destructive",
      })
      return false
    }
  }

  const userHasVoted = async (electionId: string): Promise<boolean> => {
    if (!anonymousKeypair) return false
    
    const election = elections.find((e) => e.id === electionId)
    return await checkUserHasVoted(election, anonymousKeypair)
  }

  const getVoteCount = (electionId: string) => {
    const election = elections.find((e) => e.id === electionId)
    return calculateVoteCount(election)
  }

  const refreshElections = async () => {
    await loadElections()
  }

  const value = {
    elections,
    loading,
    createElection,
    castVote,
    userHasVoted,
    getVoteCount,
    refreshElections,
  }

  return (
    <ElectionContext.Provider value={value}>
      {children}
    </ElectionContext.Provider>
  )
}
