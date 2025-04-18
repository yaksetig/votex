
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
      signature: vote.signature,
      nullifier: vote.nullifier || '', // Include nullifier and provide default
      timestamp: vote.timestamp,
    }));

    return {
      id: election.id,
      title: election.title,
      description: election.description,
      creator: election.creator,
      endDate: new Date(election.end_date),
      option1: election.option1 || 'Yes',  // Use default if not present
      option2: election.option2 || 'No',   // Use default if not present
      votes: processedVotes,
      createdAt: new Date(election.created_at),
    };
  });
};

export const createElectionInDb = async (
  title: string, 
  description: string, 
  creator: string,
  endDate: Date, 
  option1: string, 
  option2: string
) => {
  console.log("Creating election with data:", { title, description, creator, endDate, option1, option2 });

  try {
    const { data, error } = await supabase
      .from('elections')
      .insert([
        {
          title,
          description,
          creator,
          end_date: endDate.toISOString(),
          option1,
          option2,
        }
      ])
      .select();

    if (error) {
      console.error("Error in createElectionInDb:", error);
      throw error;
    }
    
    if (!data || data.length === 0) {
      throw new Error("No data returned after creating election");
    }
    
    console.log("Successfully created election:", data);
    return data;
  } catch (error) {
    console.error("Exception in createElectionInDb:", error);
    throw error;
  }
};

export const castVoteInDb = async (
  electionId: string, 
  voter: string, 
  choice: string, 
  signature: string,
  nullifier: string
) => {
  try {
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

    const { error } = await supabase
      .from('votes')
      .insert([
        {
          election_id: electionId,
          voter,
          choice,
          signature,
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
    console.error("Exception in castVoteInDb:", error);
    throw error;
  }
};
