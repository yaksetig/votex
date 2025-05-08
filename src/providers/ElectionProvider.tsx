
import React, { createContext, useContext, useEffect, useState } from "react";
import { ElectionContextType, ElectionProviderProps } from "@/contexts/ElectionContextTypes";
import { Election } from "@/types/election";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/contexts/WalletContext";
import { generateNullifier } from "@/services/ffjavascriptBabyJubjubService";
import { useRealtimeSubscriptions } from "@/hooks/useRealtimeSubscriptions";

// Create the context
export const ElectionContext = createContext<ElectionContextType | undefined>(undefined);

// Custom hook to use the election context
export function useElection() {
  const context = useContext(ElectionContext);
  if (context === undefined) {
    throw new Error("useElection must be used within an ElectionProvider");
  }
  return context;
}

export function ElectionProvider({ children }: ElectionProviderProps) {
  const [elections, setElections] = useState<Election[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { anonymousKeypair } = useWallet();
  
  // Set up realtime subscriptions
  useRealtimeSubscriptions();
  
  // Function to vote in an election
  const voteInElection = async (electionId: string, choice: string) => {
    try {
      if (!anonymousKeypair) {
        toast({
          title: "Not authenticated",
          description: "You need to verify your identity before voting.",
          variant: "destructive",
        });
        return;
      }
      
      // Find the election
      const election = elections.find((e) => e.id === electionId);
      if (!election) {
        toast({
          title: "Election not found",
          description: "Could not find the election to vote in.",
          variant: "destructive",
        });
        return;
      }
      
      // Generate a nullifier specific to this election and user
      const nullifier = await generateNullifier(electionId, anonymousKeypair);
      
      // Check if a vote with this nullifier already exists
      const { data: existingVotes } = await supabase
        .from("votes")
        .select("id")
        .eq("election_id", electionId)
        .eq("nullifier", nullifier);
      
      if (existingVotes && existingVotes.length > 0) {
        toast({
          title: "Already voted",
          description: "You have already cast a vote in this election.",
          variant: "destructive",
        });
        return;
      }
      
      // Add vote to database
      const { error: insertError } = await supabase.from("votes").insert({
        election_id: electionId,
        choice,
        nullifier,
      });
      
      if (insertError) {
        console.error("Error submitting vote:", insertError);
        toast({
          title: "Voting failed",
          description: "Could not submit your vote. Please try again.",
          variant: "destructive",
        });
        return;
      }
      
      toast({
        title: "Vote submitted",
        description: "Your vote has been cast anonymously.",
      });
    } catch (error) {
      console.error("Error in voteInElection:", error);
      toast({
        title: "Voting failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  // Function to fetch elections from API
  const fetchElections = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from("elections")
        .select(`
          *,
          votes (*)
        `)
        .order("created_at", { ascending: false });
      
      if (error) {
        throw error;
      }
      
      setElections(data || []);
    } catch (err) {
      console.error("Error fetching elections:", err);
      setError("Failed to load elections. Please try again later.");
      toast({
        title: "Error loading elections",
        description: "Could not load election data. Please try refreshing the page.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Create a new election
  const createElection = async (title: string, description: string, option1: string, option2: string) => {
    try {
      const { data, error } = await supabase
        .from("elections")
        .insert({ title, description, option1, option2 })
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      toast({
        title: "Election created",
        description: "Your new election has been created successfully.",
      });
      
      // Refresh the elections list
      fetchElections();
      
      return data;
    } catch (err) {
      console.error("Error creating election:", err);
      toast({
        title: "Error creating election",
        description: "Could not create the election. Please try again.",
        variant: "destructive",
      });
      return null;
    }
  };
  
  // Fetch elections on component mount
  useEffect(() => {
    fetchElections();
  }, []);
  
  // Expose the context value
  const contextValue: ElectionContextType = {
    elections,
    isLoading,
    error,
    fetchElections,
    createElection,
    voteInElection,
  };
  
  return (
    <ElectionContext.Provider value={contextValue}>
      {children}
    </ElectionContext.Provider>
  );
}
