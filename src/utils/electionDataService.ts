
import { supabase } from "@/integrations/supabase/client";
import { Election, Vote } from "@/types/election";

export const fetchElectionsAndVotes = async (): Promise<Election[]> => {
  // Fetch elections
  const { data: electionsData, error: electionsError } = await supabase
    .from('elections')
    .select('*')
    .order('created_at', { ascending: false });

  if (electionsError) {
    console.error("Error fetching elections:", electionsError);
    throw electionsError;
  }

  if (!electionsData || electionsData.length === 0) {
    console.log("No elections found in database");
    return [];
  }

  // Fetch votes for all elections
  const { data: votesData, error: votesError } = await supabase
    .from('votes')
    .select('*');

  if (votesError) {
    console.error("Error fetching votes:", votesError);
    throw votesError;
  }

  // Process the data
  return electionsData.map((election) => {
    const electionVotes = votesData ? votesData.filter(vote => vote.election_id === election.id) : [];
    const processedVotes = electionVotes.map(vote => ({
      id: vote.id,
      voter: vote.voter,
      choice: vote.choice,
      nullifier: vote.nullifier || '', 
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
};

// Get all elections
export const getElections = async (): Promise<Election[]> => {
  return fetchElectionsAndVotes();
};

// Create a new election
export const createElection = async (
  title: string, 
  description: string,
  endDateISO: string, 
  option1: string,
  option2: string,
  userId: string
): Promise<Election> => {
  try {
    // Create the election in the database
    const { data, error } = await supabase
      .from('elections')
      .insert([
        {
          title,
          description,
          creator: userId,
          end_date: endDateISO,
          option1,
          option2,
        }
      ])
      .select();

    if (error) {
      console.error("Error creating election:", error);
      throw error;
    }
    
    if (!data || data.length === 0) {
      throw new Error("No data returned after creating election");
    }
    
    // Format and return the new election
    return {
      id: data[0].id,
      title,
      description,
      creator: userId,
      endDate: new Date(endDateISO),
      option1,
      option2,
      votes: [],
      createdAt: new Date(),
    };
  } catch (error) {
    console.error("Error in createElection:", error);
    throw error;
  }
};

// Cast a vote for an election
export const castVote = async (
  electionId: string,
  optionIndex: number,
  voteDataStr: string
): Promise<boolean> => {
  try {
    // Parse the vote data
    const voteData = JSON.parse(voteDataStr);
    const { userId, nullifier, choice, signature, publicKey, timestamp } = voteData;
    
    // Verify we have all the required fields
    if (!signature) {
      console.error("Error: Missing signature in vote data", voteData);
      throw new Error("Signature is required for casting a vote");
    }
    
    console.log("🔍 VOTE DATA:", {
      election_id: electionId,
      voter: userId,
      choice,
      nullifier,
      signature: signature ? (signature.length > 20 ? signature.substring(0, 20) + "..." : signature) : "MISSING",
      timestamp: timestamp || Date.now()
    });
    
    // Check if the nullifier already exists to prevent double voting
    try {
      const { data: existingVote, error: checkError } = await supabase
        .from('votes')
        .select('id')
        .eq('nullifier', nullifier)
        .maybeSingle();
  
      if (checkError) {
        console.error("Error checking for existing vote:", checkError);
        // Continue anyway, as it might just be that the vote doesn't exist
      }
  
      if (existingVote) {
        console.error("Vote with this nullifier already exists, ID:", existingVote.id);
        throw new Error("Double voting is not allowed");
      }
    } catch (error) {
      console.warn("Error during nullifier check (continuing):", error);
      // Continue execution, as we'll still try to insert the vote
    }

    // Prepare the vote object with all required fields from supabase schema
    const voteObject = {
      election_id: electionId,
      voter: userId,
      choice: choice,
      nullifier: nullifier,
      signature: signature,
      timestamp: timestamp || Date.now()
    };
    
    console.log("📤 SUBMITTING VOTE:", voteObject);
    
    // Submit the vote with required fields - first try with upsert
    const { data, error } = await supabase
      .from('votes')
      .insert(voteObject);
      
    if (error) {
      console.error("❌ ERROR INSERTING VOTE:", error);
      
      // Try again with a simple insert
      const simpleInsert = await supabase.rpc('insert_vote', {
        p_election_id: electionId,
        p_voter: userId,
        p_choice: choice,
        p_nullifier: nullifier,
        p_signature: signature,
        p_timestamp: timestamp || Date.now()
      });
      
      if (simpleInsert.error) {
        console.error("❌ SECOND INSERT ATTEMPT FAILED:", simpleInsert.error);
        throw simpleInsert.error;
      }
      
      console.log("✅ SECOND INSERT ATTEMPT SUCCEEDED:", simpleInsert);
      return true;
    }
    
    console.log("✅ VOTE SUBMITTED SUCCESSFULLY:", data);
    return true;
  } catch (error) {
    console.error("❌ ERROR CASTING VOTE:", error);
    return false;
  }
};
