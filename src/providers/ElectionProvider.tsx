import React, { useState, useEffect, useCallback } from "react";
import { ElectionContext } from "@/contexts/ElectionContext";
import { Election, VoteCount } from "@/types/election";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/WalletContext";
import { 
  getElections,
  createElection as createElectionService,
  castVote
} from "@/utils/electionDataService";
import { generateProof, userHasVoted, getVoteCount } from "@/utils/voteUtils";
import { useRealtimeSubscriptions } from "@/hooks/useRealtimeSubscriptions";

interface ElectionProviderProps {
  children: React.ReactNode;
}

export const ElectionProvider: React.FC<ElectionProviderProps> = ({ children }) => {
  const [elections, setElections] = useState<Election[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { userId, anonymousKeypair } = useWallet();
  
  // Refresh elections data
  const refreshElections = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getElections();
      setElections(data);
    } catch (error) {
      console.error("Error refreshing elections:", error);
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Set up realtime subscriptions
  useRealtimeSubscriptions(refreshElections);
  
  // Load elections on mount
  useEffect(() => {
    refreshElections();
  }, [refreshElections]);

  // Create a new election
  const createElection = useCallback(
    async (
      title: string, 
      description: string, 
      endDate: Date,
      option1: string, 
      option2: string
    ): Promise<Election> => {
      if (!userId) {
        toast({
          title: "Authentication required",
          description: "You need to be verified to create an election.",
          variant: "destructive",
        });
        throw new Error("Authentication required");
      }

      try {
        // Format the end date as ISO string
        const endDateISO = endDate.toISOString();
        
        const newElection = await createElectionService(
          title, 
          description,
          endDateISO,
          option1,
          option2,
          userId
        );
        
        // Update local state
        setElections((prev) => [newElection, ...prev]);
        
        toast({
          title: "Election created",
          description: "Your new election has been created successfully.",
        });
        
        return newElection;
      } catch (error) {
        console.error("Error creating election:", error);
        toast({
          title: "Creation failed",
          description: "Failed to create election. Please try again.",
          variant: "destructive",
        });
        throw error;
      }
    },
    [userId, toast]
  );

  // Vote in an election
  const vote = useCallback(
    async (electionId: string, optionIndex: number): Promise<boolean> => {
      if (!userId) {
        toast({
          title: "Authentication required",
          description: "You need to be verified to vote in an election.",
          variant: "destructive",
        });
        throw new Error("Authentication required");
      }

      if (!anonymousKeypair) {
        toast({
          title: "Anonymous identity required",
          description: "Your anonymous identity is missing. Please re-verify with World ID.",
          variant: "destructive",
        });
        throw new Error("Anonymous keypair missing");
      }

      try {
        // Find the election
        const election = elections.find((e) => e.id === electionId);
        if (!election) {
          throw new Error("Election not found");
        }

        // Check if user has already voted in this election
        const alreadyVoted = await userHasVoted(election, userId);
        if (alreadyVoted) {
          toast({
            title: "Already voted",
            description: "You have already voted in this election.",
            variant: "destructive",
          });
          return false;
        }

        console.log("Using keypair for voting:", {
          hasKeypair: !!anonymousKeypair,
          publicKeyLength: anonymousKeypair ? anonymousKeypair.publicKey.length : 0
        });

        // Generate proof with the anonymousKeypair
        const signedVoteData = await generateProof(
          electionId,
          optionIndex,
          userId,
          anonymousKeypair
        );

        // Submit the vote
        const success = await castVote(electionId, optionIndex, signedVoteData);
        
        if (success) {
          toast({
            title: "Vote cast",
            description: "Your vote has been cast successfully.",
          });
          
          // No need to update local state here as realtime subscription will handle it
          return true;
        } else {
          throw new Error("Vote failed");
        }
      } catch (error) {
        console.error("Error voting:", error);
        toast({
          title: "Vote failed",
          description: "Failed to cast your vote. Please try again.",
          variant: "destructive",
        });
        throw error;
      }
    },
    [userId, anonymousKeypair, elections, toast]
  );

  // Check if user has voted
  const checkUserHasVoted = useCallback(
    async (electionId: string): Promise<boolean> => {
      const election = elections.find(e => e.id === electionId);
      return userHasVoted(election, userId);
    },
    [elections, userId]
  );

  // Get vote count for an election
  const getElectionVoteCount = useCallback(
    (electionId: string): VoteCount => {
      const election = elections.find(e => e.id === electionId);
      return getVoteCount(election);
    },
    [elections]
  );

  // Create the context value
  const value = {
    elections,
    loading,
    createElection,
    castVote: vote,
    userHasVoted: checkUserHasVoted,
    getVoteCount: getElectionVoteCount,
    refreshElections
  };

  return (
    <ElectionContext.Provider value={value}>
      {children}
    </ElectionContext.Provider>
  );
};
