import { supabase } from "@/integrations/supabase/client";

export interface VoteChoiceCounts {
  total: number;
  option1: number;
  option2: number;
}

// Count canonical votes for an election, split by the two options. Uses
// Supabase count aggregates (head: true) to avoid transferring rows and the
// default 1000-row cap. Previously inlined in Elections.tsx.
export async function countVotesByChoice(
  electionId: string,
  option1: string,
  option2: string
): Promise<VoteChoiceCounts> {
  const [{ count: total }, { count: opt1 }, { count: opt2 }] = await Promise.all([
    supabase.from("votes").select("*", { count: "exact", head: true }).eq("election_id", electionId),
    supabase
      .from("votes")
      .select("*", { count: "exact", head: true })
      .eq("election_id", electionId)
      .eq("choice", option1),
    supabase
      .from("votes")
      .select("*", { count: "exact", head: true })
      .eq("election_id", electionId)
      .eq("choice", option2),
  ]);

  return {
    total: total ?? 0,
    option1: opt1 ?? 0,
    option2: opt2 ?? 0,
  };
}
