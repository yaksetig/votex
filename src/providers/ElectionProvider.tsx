
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
import { generateProof } from "@/utils/voteUtils";
import { useRealtimeSubscriptions } from "@/hooks/useRealtimeSubscriptions";

// Fixed: Added the proper type definition
interface ElectionProviderProps {
  children: React.ReactNode;
}

export const ElectionProvider: React.FC<ElectionProviderProps> = ({ children }) => {
  const [elections, setElections] = useState<Election[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { anonymousKeypair } = useWallet();
  
  // Set up realtime subscriptions
  useRealtimeSubscriptions();
  
  // Load elections on mount
  useEffect(() => {
    const fetchElections = async () => {
      try {
        setLoading(true);
        const data = await getElections();
        setElections(data);
      } catch (error) {
        console.error("Error fetching elections:", error);
        toast({
          title: "Failed to load elections",
          description: "Could not load election data. Please try again later.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchElections();
  }, [toast]);

  // Create a new election
  const createElection = useCallback(
    async (
      title: string, 
      description: string, 
      endDate: Date, // Fixed: Added proper parameter type
      option1: string, 
      option2: string
    ) => {
      if (!anonymousKeypair) {
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
          endDateISO, // Convert to string for the service
          option1,
          option2,
          anonymousKeypair
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
    [anonymousKeypair, toast]
  );

  // Vote in an election
  const vote = useCallback(
    async (electionId: string, optionIndex: number) => {
      if (!anonymousKeypair) {
        toast({
          title: "Authentication required",
          description: "You need to be verified to vote in an election.",
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

        // Generate zero-knowledge proof
        const proof = await generateProof(
          electionId,
          optionIndex,
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
                if (optionIndex === 0) {
                  updatedElection.votes_option_1 += 1;
                } else {
                  updatedElection.votes_option_2 += 1;
                }
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
    [anonymousKeypair, elections, toast]
  );

  const value = {
    elections,
    loading,
    createElection,
    vote,
  };

  return (
    <ElectionContext.Provider value={value}>
      {children}
    </ElectionContext.Provider>
  );
};

export default ElectionProvider;
