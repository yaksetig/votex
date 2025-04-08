
import { supabase } from "@/integrations/supabase/client";
import { Election, Vote } from "@/types/election";

export const fetchElectionsAndVotes = async (): Promise<Election[]> => {
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
  return electionsData.map((election) => {
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
    throw error;
  }
  
  return data;
};

export const castVoteInDb = async (
  electionId: string, 
  voter: string, 
  choice: string, 
  signature: string
) => {
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
    throw error;
  }
  
  return true;
};
