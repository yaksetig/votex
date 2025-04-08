import React, { createContext, useState, useContext, ReactNode, useEffect } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

// Define our election types
export interface Vote {
  id?: string;
  voter: string;
  choice: string;
  signature: string;
  timestamp: number;
}

export interface Election {
  id: string;
  title: string;
  description: string;
  creator: string;
  endDate: Date;
  option1: string;
  option2: string;
  votes: Vote[];
  createdAt: Date;
}

interface ElectionContextType {
  elections: Election[];
  loading: boolean;
  createElection: (title: string, description: string, endDate: Date, option1: string, option2: string) => Promise<void>;
  castVote: (electionId: string, choice: string) => Promise<boolean>;
  userHasVoted: (electionId: string) => boolean;
  getVoteCount: (electionId: string) => { option1: number; option2: number };
  refreshElections: () => Promise<void>;
}

const ElectionContext = createContext<ElectionContextType>({
  elections: [],
  loading: false,
  createElection: async () => {},
  castVote: async () => false,
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

  // Load elections from Supabase on mount
  const fetchElectionsAndVotes = async () => {
    try {
      setLoading(true);
      // Fetch elections
      const { data: electionsData, error: electionsError } = await supabase
        .from('elections')
        .select('*')
        .order('created_at', { ascending: false });

      if (electionsError) {
        throw electionsError;
      }

      // Fetch votes for all elections
      const { data: votesData, error: votesError } = await supabase
        .from('votes')
        .select('*');

      if (votesError) {
        throw votesError;
      }

      // Process the data
      const processedElections = electionsData.map((election) => {
        const electionVotes = votesData.filter(vote => vote.election_id === election.id);
        const processedVotes = electionVotes.map(vote => ({
          id: vote.id,
          voter: vote.voter,
          choice: vote.choice,
          signature: vote.signature,
          timestamp: vote.timestamp,
        }));

        return {
          id: election.id,
          title: election.title,
          description: election.description,
          creator: election.creator,
          endDate: new Date(election.end_date),
          option1: election.option1 || 'Yes',
          option2: election.option2 || 'No',
          votes: processedVotes,
          createdAt: new Date(election.created_at),
        };
      });

      setElections(processedElections);
    } catch (error) {
      console.error("Error fetching elections:", error);
      toast({
        title: "Error fetching elections",
        description: "Could not load elections. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchElectionsAndVotes();
    
    // Set up realtime subscription for elections
    const electionsChannel = supabase
      .channel('public:elections')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public',
        table: 'elections'
      }, () => {
        fetchElectionsAndVotes();
      })
      .subscribe();
    
    // Set up realtime subscription for votes
    const votesChannel = supabase
      .channel('public:votes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public',
        table: 'votes'
      }, () => {
        fetchElectionsAndVotes();
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
      const { data, error } = await supabase
        .from('elections')
        .insert([
          {
            title,
            description,
            creator: address,
            end_date: endDate.toISOString(),
            option1,
            option2,
          }
        ])
        .select();

      if (error) {
        throw error;
      }

      toast({
        title: "Election created",
        description: `"${title}" has been created successfully.`,
      });
      
      // Refresh elections
      await fetchElectionsAndVotes();
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
      // Sign message with wallet
      const message = `Vote ${choice} on Election: ${election.id}`;
      const signature = await signMessage(message);
      if (!signature) return false;

      // Add vote to Supabase
      const { error } = await supabase
        .from('votes')
        .insert([
          {
            election_id: electionId,
            voter: address,
            choice,
            signature,
            timestamp: Date.now(),
          }
        ]);

      if (error) {
        throw error;
      }

      toast({
        title: "Vote cast",
        description: `You have successfully voted "${choice}" in "${election.title}".`,
      });

      // Refresh elections
      await fetchElectionsAndVotes();
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

  const userHasVoted = (electionId: string): boolean => {
    if (!address) return false;
    const election = elections.find((e) => e.id === electionId);
    if (!election) return false;
    return election.votes.some((vote) => vote.voter === address);
  };

  const getVoteCount = (electionId: string) => {
    const election = elections.find((e) => e.id === electionId);
    if (!election) return { option1: 0, option2: 0 };
    
    const option1Count = election.votes.filter((vote) => vote.choice === election.option1).length;
    const option2Count = election.votes.filter((vote) => vote.choice === election.option2).length;
    
    return { option1: option1Count, option2: option2Count };
  };

  const refreshElections = async () => {
    await fetchElectionsAndVotes();
  };

  return (
    <ElectionContext.Provider
      value={{
        elections,
        loading,
        createElection,
        castVote,
        userHasVoted,
        getVoteCount,
        refreshElections,
      }}
    >
      {children}
    </ElectionContext.Provider>
  );
};
