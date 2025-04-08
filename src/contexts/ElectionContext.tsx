import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Election, VoteCount } from "@/types/election";
import { 
  fetchElectionsAndVotes, 
  createElectionInDb, 
  castVoteInDb, 
  deleteElectionFromDb 
} from "@/utils/electionDataService";
import { userHasVoted as checkUserHasVoted, getVoteCount as calculateVoteCount } from "@/utils/voteUtils";

interface ElectionContextType {
  elections: Election[];
  loading: boolean;
  createElection: (title: string, description: string, endDate: Date, option1: string, option2: string) => Promise<void>;
  castVote: (electionId: string, choice: string) => Promise<boolean>;
  deleteElection: (electionId: string) => Promise<boolean>;
  userHasVoted: (electionId: string) => boolean;
  getVoteCount: (electionId: string) => VoteCount;
  refreshElections: () => Promise<void>;
}

const ElectionContext = createContext<ElectionContextType>({
  elections: [],
  loading: false,
  createElection: async () => {},
  castVote: async () => false,
  deleteElection: async () => false,
  userHasVoted: () => false,
  getVoteCount: () => ({ option1: 0, option2: 0 }),
  refreshElections: async () => {},
});

export const useElections = () => useContext(ElectionContext);

interface ElectionProviderProps {
  children: ReactNode;
}

export const ElectionProvider: React.FC<ElectionProviderProps> = ({ children }) => {
  const [elections, setElections] = useState<Election[]>([]);
  const [loading, setLoading] = useState(true);
  const { address, signMessage } = useWallet();
  const { toast } = useToast();
  
  // Track deleted election IDs to prevent them from reappearing in the UI
  const [deletedElectionIds, setDeletedElectionIds] = useState<Set<string>>(new Set());

  const loadElections = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchElectionsAndVotes();
      console.log(`Loaded ${data.length} elections from database`);
      
      // Filter out any elections that we know were deleted
      const filteredData = data.filter(election => !deletedElectionIds.has(election.id));
      if (filteredData.length !== data.length) {
        console.log(`Filtered out ${data.length - filteredData.length} deleted elections`);
      }
      
      setElections(filteredData);
      return filteredData;
    } catch (error) {
      console.error("Error fetching elections:", error);
      toast({
        title: "Error fetching elections",
        description: "Could not load elections. Please try again.",
        variant: "destructive",
      });
      return [];
    } finally {
      setLoading(false);
    }
  }, [toast, deletedElectionIds]);

  useEffect(() => {
    loadElections();
    
    // Set up Supabase realtime subscriptions
    const electionsChannel = supabase
      .channel('public:elections')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public',
        table: 'elections'
      }, (payload) => {
        // For deletes, we've already handled this in our UI
        if (payload.eventType === 'DELETE') {
          console.log('Received DELETE event from Supabase for election:', payload.old.id);
          // Make sure this ID is in our deleted set
          setDeletedElectionIds(prev => {
            const newSet = new Set(prev);
            newSet.add(payload.old.id);
            return newSet;
          });
          
          // Also update our elections list by filtering out this ID
          setElections(prev => prev.filter(e => e.id !== payload.old.id));
          return;
        }
        
        // For other changes, refresh the data
        console.log(`Received ${payload.eventType} event from Supabase, refreshing elections`);
        loadElections();
      })
      .subscribe();
    
    const votesChannel = supabase
      .channel('public:votes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public',
        table: 'votes'
      }, () => {
        loadElections();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(electionsChannel);
      supabase.removeChannel(votesChannel);
    };
  }, [loadElections]);

  const createElection = async (title: string, description: string, endDate: Date, option1: string, option2: string) => {
    if (!address) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to create an election.",
        variant: "destructive",
      });
      return;
    }

    try {
      await createElectionInDb(title, description, address, endDate, option1, option2);
      
      toast({
        title: "Election created",
        description: `"${title}" has been created successfully.`,
      });
      
      await loadElections();
    } catch (error) {
      console.error("Error creating election:", error);
      toast({
        title: "Error creating election",
        description: "Could not create the election. Please try again.",
        variant: "destructive",
      });
    }
  };

  const castVote = async (electionId: string, choice: string): Promise<boolean> => {
    if (!address) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to vote.",
        variant: "destructive",
      });
      return false;
    }

    const election = elections.find((e) => e.id === electionId);
    if (!election) {
      toast({
        title: "Election not found",
        description: "Could not find the specified election.",
        variant: "destructive",
      });
      return false;
    }

    if (election.endDate < new Date()) {
      toast({
        title: "Election ended",
        description: "This election has already ended.",
        variant: "destructive",
      });
      return false;
    }

    if (userHasVoted(electionId)) {
      toast({
        title: "Already voted",
        description: "You have already cast a vote in this election.",
        variant: "destructive",
      });
      return false;
    }

    try {
      const message = `Vote ${choice} on Election: ${election.id}`;
      const signature = await signMessage(message);
      if (!signature) return false;

      await castVoteInDb(electionId, address, choice, signature);

      toast({
        title: "Vote cast",
        description: `You have successfully voted "${choice}" in "${election.title}".`,
      });

      await loadElections();
      return true;
    } catch (error) {
      console.error("Error casting vote:", error);
      toast({
        title: "Error casting vote",
        description: "Could not cast your vote. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteElection = async (electionId: string): Promise<boolean> => {
    if (!address) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to delete an election.",
        variant: "destructive",
      });
      return false;
    }

    console.log(`Checking election with ID: ${electionId}`);
    const election = elections.find((e) => e.id === electionId);
    if (!election) {
      console.log("Election not found");
      toast({
        title: "Election not found",
        description: "Could not find the specified election.",
        variant: "destructive",
      });
      return false;
    }

    console.log(`Election creator: ${election.creator}, User address: ${address}`);
    if (election.creator !== address) {
      console.log("Permission denied - creator mismatch");
      toast({
        title: "Permission denied",
        description: "You can only delete elections you've created.",
        variant: "destructive",
      });
      return false;
    }

    try {
      console.log("Calling deleteElectionFromDb");
      
      // Immediately remove from UI
      setElections(prevElections => prevElections.filter(e => e.id !== electionId));
      
      // Add to deleted IDs set to prevent reappearance
      setDeletedElectionIds(prev => {
        const newSet = new Set(prev);
        newSet.add(electionId);
        return newSet;
      });
      
      const deleteSuccess = await deleteElectionFromDb(electionId);
      
      if (deleteSuccess) {
        toast({
          title: "Election deleted",
          description: `"${election.title}" has been deleted successfully.`,
        });
      } else {
        toast({
          title: "Partial deletion",
          description: "The election may still exist in the database. Please try again.",
          variant: "destructive",
        });
        
        // Despite DB issues, keep it removed from UI
        return true;
      }
      
      return true;
    } catch (error) {
      console.error("Error deleting election:", error);
      
      // Re-add the election to the list if deletion failed
      await loadElections();
      
      // Remove from deleted IDs set since deletion failed
      setDeletedElectionIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(electionId);
        return newSet;
      });
      
      toast({
        title: "Error deleting election",
        description: "Could not delete the election. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  };

  const userHasVoted = (electionId: string): boolean => {
    if (!address) return false;
    const election = elections.find((e) => e.id === electionId);
    return checkUserHasVoted(election, address);
  };

  const getVoteCount = (electionId: string): VoteCount => {
    const election = elections.find((e) => e.id === electionId);
    return calculateVoteCount(election);
  };

  const refreshElections = async () => {
    await loadElections();
  };

  return (
    <ElectionContext.Provider
      value={{
        elections,
        loading,
        createElection,
        castVote,
        deleteElection,
        userHasVoted,
        getVoteCount,
        refreshElections,
      }}
    >
      {children}
    </ElectionContext.Provider>
  );
};

export type { Election, VoteCount } from "@/types/election";
