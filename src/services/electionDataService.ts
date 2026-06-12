
import { supabase } from '@/integrations/supabase/client';
import { getElectionStatus } from '@/lib/electionStatus';

export interface AuthorityElection {
  id: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
  end_date: string;
  closed_manually_at?: string;
  option1: string;
  option2: string;
  vote_count?: number;
  tally_processed: boolean;
}

// Get all elections for an election authority
// Throws on query error so callers (react-query) can surface an error state
// rather than rendering an empty list for a real failure.
export async function getElectionsForAuthority(authorityId: string): Promise<AuthorityElection[]> {
  const { data: elections, error } = await supabase
    .from('elections')
    .select(`
      *,
      votes(id)
    `)
    .eq('authority_id', authorityId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  // Check which of these elections have been tallied
  const electionIds = elections?.map(e => e.id) || [];
  const { data: talliedElections, error: tallyError } = await supabase
    .from('election_tallies')
    .select('election_id')
    .in('election_id', electionIds);

  if (tallyError) {
    throw tallyError;
  }

  const talliedElectionIds = new Set(talliedElections?.map(t => t.election_id) || []);

  return (elections || []).map(election => ({
    id: election.id,
    title: election.title,
    description: election.description,
    status: getElectionStatus(election),
    created_at: election.created_at,
    end_date: election.end_date,
    closed_manually_at: election.closed_manually_at,
    option1: election.option1,
    option2: election.option2,
    vote_count: election.votes?.length || 0,
    tally_processed: talliedElectionIds.has(election.id),
  }));
}
