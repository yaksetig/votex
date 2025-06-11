
import { supabase } from '@/integrations/supabase/client';

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
}

// Get all elections for an election authority
export async function getElectionsForAuthority(authorityId: string): Promise<AuthorityElection[]> {
  try {
    console.log(`Fetching elections for authority: ${authorityId}`);
    
    const { data: elections, error } = await supabase
      .from('elections')
      .select(`
        *,
        votes(id)
      `)
      .eq('authority_id', authorityId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching elections:', error);
      return [];
    }

    // Process elections to add vote counts and determine status
    const processedElections: AuthorityElection[] = elections?.map(election => {
      const now = new Date();
      const endDate = new Date(election.end_date);
      
      let status = election.status || 'active';
      if (election.closed_manually_at) {
        status = 'closed_manually';
      } else if (now > endDate) {
        status = 'expired';
      }

      return {
        id: election.id,
        title: election.title,
        description: election.description,
        status,
        created_at: election.created_at,
        end_date: election.end_date,
        closed_manually_at: election.closed_manually_at,
        option1: election.option1,
        option2: election.option2,
        vote_count: election.votes?.length || 0
      };
    }) || [];

    console.log(`Found ${processedElections.length} elections for authority`);
    return processedElections;
  } catch (error) {
    console.error('Error in getElectionsForAuthority:', error);
    return [];
  }
}
