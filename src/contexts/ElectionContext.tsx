import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from "react"
import { useWallet } from "@/contexts/WalletContext"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { RealtimeChannel } from '@supabase/supabase-js';
import { Election, VoteCount } from "@/types/election"
import { 
  fetchElectionsAndVotes, 
  createElectionInDb, 
  castVoteInDb,
} from "@/utils/electionDataService"
import { userHasVoted as checkUserHasVoted, getVoteCount as calculateVoteCount } from "@/utils/voteUtils"
import { signWithKeypair, getPublicKeyString, generateNullifier } from "@/services/babyJubjubService"

interface ElectionContextType {
  elections: Election[]
  loading: boolean
  createElection: (title: string, description: string, endDate: Date, option1: string, option2: string) => Promise<void>
  castVote: (electionId: string, choice: string) => Promise<boolean>
  userHasVoted: (electionId: string) => Promise<boolean>
  getVoteCount: (electionId: string) => VoteCount
  refreshElections: () => Promise<void>
}

const ElectionContext = createContext<ElectionContextType>({
  elections: [],
  loading: false,
  createElection: async () => {},
  castVote: async () => false,
  userHasVoted: async () => false,
  getVoteCount: () => ({ option1: 0, option2: 0 }),
  refreshElections: async () => {},
})

export const useElections = () => useContext(ElectionContext)

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
      return data
    } catch (error) {
      console.error("Error fetching elections:", error)
      toast({
        title: "Error fetching elections",
        description: "Could not load elections. Please try again.",
        variant: "destructive",
      })
      return []
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadElections()
    
    let electionsChannel: RealtimeChannel;
    let votesChannel: RealtimeChannel;
    
    try {
      electionsChannel = supabase
        .channel('public:elections')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public',
          table: 'elections'
        }, () => {
          loadElections()
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED' || status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
            console.log('Elections channel status:', status);
          }
        })
      
      votesChannel = supabase
        .channel('public:votes')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public',
          table: 'votes'
        }, () => {
          loadElections()
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED' || status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
            console.log('Votes channel status:', status);
          }
        })
    } catch (error) {
      console.error('Error setting up real-time subscriptions:', error);
    }

    return () => {
      if (electionsChannel) supabase.removeChannel(electionsChannel)
      if (votesChannel) supabase.removeChannel(votesChannel)
    }
  }, [loadElections])

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
      const anonymousSignature = await signWithKeypair(message, anonymousKeypair)
      
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

  const getVoteCount = (electionId: string): VoteCount => {
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

export type { Election, VoteCount } from "@/types/election"
