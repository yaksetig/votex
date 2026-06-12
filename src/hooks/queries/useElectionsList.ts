import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getElectionVoteData } from "@/services/voteTrackingService";
import { countVotesByChoice } from "@/lib/voteCounts";

export interface ElectionRecord {
  id: string;
  title: string;
  description: string;
  option1: string;
  option2: string;
  end_date: string;
  closed_manually_at?: string | null;
  authority_id?: string | null;
  election_authorities?: { name?: string | null } | null;
  voteCount: number;
  option1Count: number;
  option2Count: number;
}

// Fetch all elections enriched with their authority name and vote counts.
// Throws on any query error so the caller surfaces an error state instead of
// silently rendering an empty list.
async function fetchElectionsList(): Promise<ElectionRecord[]> {
  const { data: electionsData, error: electionsError } = await supabase
    .from("elections")
    .select("*")
    .order("created_at", { ascending: false });

  if (electionsError) {
    throw electionsError;
  }

  const authorityIds = [
    ...new Set(
      (electionsData || [])
        .map((election) => election.authority_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const authoritiesById = new Map<string, { name?: string | null }>();
  if (authorityIds.length > 0) {
    const { data: authoritiesData, error: authoritiesError } = await supabase
      .from("election_authorities")
      .select("id, name")
      .in("id", authorityIds);

    if (authoritiesError) {
      throw authoritiesError;
    }

    (authoritiesData || []).forEach((authority) => {
      authoritiesById.set(authority.id, authority);
    });
  }

  return Promise.all(
    (electionsData || []).map(async (election) => {
      const voteData = await getElectionVoteData(election.id);

      let voteCount = 0;
      let option1Count = 0;
      let option2Count = 0;

      if (voteData) {
        voteCount = voteData.totalYesVotes + voteData.totalNoVotes;
        option1Count = voteData.validYesVotes;
        option2Count = voteData.validNoVotes;
      } else {
        const counts = await countVotesByChoice(
          election.id,
          election.option1,
          election.option2
        );
        voteCount = counts.total;
        option1Count = counts.option1;
        option2Count = counts.option2;
      }

      return {
        ...election,
        election_authorities: election.authority_id
          ? authoritiesById.get(election.authority_id) || null
          : null,
        voteCount,
        option1Count,
        option2Count,
      } as ElectionRecord;
    })
  );
}

export function useElectionsList() {
  return useQuery({
    queryKey: ["elections-list"],
    queryFn: fetchElectionsList,
  });
}
