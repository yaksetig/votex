
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
  proof: string
): Promise<boolean> => {
  try {
    // Parse the proof object
    const proofData = JSON.parse(proof);
    const { userId, nullifier, choice } = proofData;
    
    // Check if the nullifier already exists to prevent double voting
    const { data: existingVote, error: checkError } = await supabase
      .from('votes')
      .select('*')
      .eq('nullifier', nullifier)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error("Error checking for existing vote:", checkError);
      throw checkError;
    }

    if (existingVote) {
      console.error("Vote with this nullifier already exists");
      throw new Error("Double voting is not allowed");
    }

    // Submit the vote
    const { error } = await supabase
      .from('votes')
      .insert([
        {
          election_id: electionId,
          voter: userId,
          choice,
          nullifier,
          timestamp: Date.now(),
        }
      ]);

    if (error) {
      console.error("Error casting vote:", error);
      throw error;
    }
    
    return true;
  } catch (error) {
    console.error("Error casting vote:", error);
    return false;
  }
};
