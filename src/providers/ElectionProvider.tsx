
import React, { useState, useEffect, useCallback } from "react";
import { ElectionContext } from "@/contexts/ElectionContext";
import { Election } from "@/types/election";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/WalletContext";
import { 
  getElections,
  createElection as createElectionService,
  castVote
} from "@/utils/electionDataService";
import { generateProof, userHasVoted, getVoteCount } from "@/utils/voteUtils";

interface ElectionProviderProps {
  children: React.ReactNode;
}

export const ElectionProvider: React.FC<ElectionProviderProps> = ({ children }) => {
  const [elections, setElections] = useState<Election[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { userId, anonymousKeypair } = useWallet();
  
  // Set up realtime subscriptions
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
      if (!userId || !anonymousKeypair) {
        toast({
          title: "Authentication required",
          description: "You need to be verified with an anonymous identity to vote.",
          variant: "destructive",
        });
        throw new Error("Authentication required");
      }

      try {
        // Find the election
        const election = elections.find((e) => e.id === electionId);
        if (!election) {
          throw new Error("Election not found");
        }

        // Generate proof with the anonymousKeypair
        const proof = await generateProof(
          electionId,
          optionIndex,
          userId,
          anonymousKeypair
        );

        // Submit the vote
        const success = await castVote(electionId, optionIndex, proof);
        
        if (success) {
          toast({
            title: "Vote cast",
            description: "Your vote has been cast successfully.",
          });
          
          // Update local state (in a real app, this would come from the realtime subscription)
          setElections((prev) =>
            prev.map((e) => {
              if (e.id === electionId) {
                // Clone and update the vote counts
                const updatedElection = { ...e };
                const newVote = {
                  id: `temp-${Date.now()}`,
                  voter: userId,
                  choice: optionIndex === 0 ? election.option1 : election.option2,
                  nullifier: generateSimpleNullifier(electionId, userId),
                  timestamp: Date.now()
                };
                
                updatedElection.votes = [...updatedElection.votes, newVote];
                return updatedElection;
              }
              return e;
            })
          );
          
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

  // Create the context value
  const value = {
    elections,
    loading,
    createElection,
    castVote: vote,
    userHasVoted: (electionId: string) => {
      const election = elections.find(e => e.id === electionId);
      return userHasVoted(election, userId);
    },
    getVoteCount: (electionId: string) => {
      const election = elections.find(e => e.id === electionId);
      return getVoteCount(election);
    },
    refreshElections
  };

  return (
    <ElectionContext.Provider value={value}>
      {children}
    </ElectionContext.Provider>
  );
};

export default ElectionProvider;
