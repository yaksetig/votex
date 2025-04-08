
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
  signature: string
) => {
  try {
    const { error } = await supabase
      .from('votes')
      .insert([
        {
          election_id: electionId,
          voter,
          choice,
          signature,
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

export const deleteElectionFromDb = async (electionId: string) => {
  console.log(`Starting deletion process for election ${electionId}`);
  
  // First, check if the election exists
  const { data: electionCheck, error: checkError } = await supabase
    .from('elections')
    .select('id')
    .eq('id', electionId)
    .single();
    
  if (checkError) {
    console.error("Error checking election existence:", checkError);
    throw new Error(`Election with ID ${electionId} does not exist or cannot be accessed`);
  }
  
  // Delete votes associated with the election first
  const { error: votesError } = await supabase
    .from('votes')
    .delete()
    .eq('election_id', electionId);
  
  if (votesError) {
    console.error("Error deleting votes:", votesError);
    throw votesError;
  }
  
  console.log(`Successfully deleted votes for election ${electionId}, now deleting election`);
  
  // Then delete the election itself
  const { error: electionError } = await supabase
    .from('elections')
    .delete()
    .eq('id', electionId);
  
  if (electionError) {
    console.error("Error deleting election:", electionError);
    throw electionError;
  }
  
  console.log(`Successfully deleted election ${electionId}`);
  
  // Double-check the election was deleted
  const { data: verifyDelete, error: verifyError } = await supabase
    .from('elections')
    .select('id')
    .eq('id', electionId);
    
  if (verifyError) {
    console.error("Error verifying deletion:", verifyError);
  } else if (verifyDelete && verifyDelete.length > 0) {
    console.error("Election still exists after deletion attempt");
    throw new Error("Failed to delete election - it still exists in the database");
  } else {
    console.log("Verified deletion: election no longer exists in database");
  }
  
  return true;
};
