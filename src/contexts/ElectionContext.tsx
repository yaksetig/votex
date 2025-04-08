
import React, { createContext, useState, useContext, ReactNode, useEffect } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { useToast } from "@/components/ui/use-toast";

// Define our election types
export interface Vote {
  voter: string;
  choice: "Yes" | "No";
  signature: string;
  timestamp: number;
}

export interface Election {
  id: string;
  title: string;
  description: string;
  creator: string;
  endDate: Date;
  votes: Vote[];
  createdAt: Date;
}

interface ElectionContextType {
  elections: Election[];
  createElection: (title: string, description: string, endDate: Date) => void;
  castVote: (electionId: string, choice: "Yes" | "No") => Promise<boolean>;
  userHasVoted: (electionId: string) => boolean;
  getVoteCount: (electionId: string) => { yes: number; no: number };
}

const ElectionContext = createContext<ElectionContextType>({
  elections: [],
  createElection: () => {},
  castVote: async () => false,
  userHasVoted: () => false,
  getVoteCount: () => ({ yes: 0, no: 0 }),
});

export const useElections = () => useContext(ElectionContext);

interface ElectionProviderProps {
  children: ReactNode;
}

export const ElectionProvider: React.FC<ElectionProviderProps> = ({ children }) => {
  const [elections, setElections] = useState<Election[]>([]);
  const { address, signMessage } = useWallet();
  const { toast } = useToast();

  // Load elections from localStorage on mount
  useEffect(() => {
    const storedElections = localStorage.getItem("crypto-vote-elections");
    if (storedElections) {
      try {
        const parsed = JSON.parse(storedElections);
        // Convert string dates back to Date objects
        const electionsWithDates = parsed.map((election: any) => ({
          ...election,
          endDate: new Date(election.endDate),
          createdAt: new Date(election.createdAt),
        }));
        setElections(electionsWithDates);
      } catch (error) {
        console.error("Error parsing stored elections:", error);
      }
    }
  }, []);

  // Save elections to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("crypto-vote-elections", JSON.stringify(elections));
  }, [elections]);

  const createElection = (title: string, description: string, endDate: Date) => {
    if (!address) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to create an election.",
        variant: "destructive",
      });
      return;
    }

    const newElection: Election = {
      id: crypto.randomUUID(),
      title,
      description,
      creator: address,
      endDate,
      votes: [],
      createdAt: new Date(),
    };

    setElections((prev) => [...prev, newElection]);
    toast({
      title: "Election created",
      description: `"${title}" has been created successfully.`,
    });
  };

  const castVote = async (electionId: string, choice: "Yes" | "No"): Promise<boolean> => {
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

    // Sign message with wallet
    const message = `Vote ${choice} on Election: ${election.id}`;
    const signature = await signMessage(message);
    if (!signature) return false;

    // Add vote
    const newVote: Vote = {
      voter: address,
      choice,
      signature,
      timestamp: Date.now(),
    };

    setElections((prev) =>
      prev.map((e) =>
        e.id === electionId ? { ...e, votes: [...e.votes, newVote] } : e
      )
    );

    toast({
      title: "Vote cast",
      description: `You have successfully voted "${choice}" in "${election.title}".`,
    });

    return true;
  };

  const userHasVoted = (electionId: string): boolean => {
    if (!address) return false;
    const election = elections.find((e) => e.id === electionId);
    if (!election) return false;
    return election.votes.some((vote) => vote.voter === address);
  };

  const getVoteCount = (electionId: string) => {
    const election = elections.find((e) => e.id === electionId);
    if (!election) return { yes: 0, no: 0 };
    
    const yes = election.votes.filter((vote) => vote.choice === "Yes").length;
    const no = election.votes.filter((vote) => vote.choice === "No").length;
    
    return { yes, no };
  };

  return (
    <ElectionContext.Provider
      value={{
        elections,
        createElection,
        castVote,
        userHasVoted,
        getVoteCount,
      }}
    >
      {children}
    </ElectionContext.Provider>
  );
};
