
import React, { createContext, useState, useContext, ReactNode, useEffect } from "react";
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

  const loadElections = async () => {
    try {
      setLoading(true);
      const data = await fetchElectionsAndVotes();
      console.log(`Loaded ${data.length} elections from database`);
      setElections(data);
      return data;
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
  };

  useEffect(() => {
    loadElections();
    
    const electionsChannel = supabase
      .channel('public:elections')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public',
        table: 'elections'
      }, () => {
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
  }, []);

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
      await deleteElectionFromDb(electionId);
      
      toast({
        title: "Election deleted",
        description: `"${election.title}" has been deleted successfully.`,
      });
      
      console.log("Refreshing elections after delete");
      
      // Force update the local state by filtering out the deleted election
      setElections(prevElections => 
        prevElections.filter(e => e.id !== electionId)
      );
      
      // Also refresh from the database to ensure we have the latest data
      const refreshedData = await loadElections();
      
      // Double check the election was removed
      if (refreshedData.some(e => e.id === electionId)) {
        console.error("Election still present after deletion and refresh");
        toast({
          title: "Sync error",
          description: "The election appears to be deleted but is still showing. Please refresh the page.",
          variant: "destructive",
        });
      }
      
      return true;
    } catch (error) {
      console.error("Error deleting election:", error);
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
