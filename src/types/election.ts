import { Tables } from "@/integrations/supabase/types";

export type Election = Tables<"elections">;
export type Vote = Tables<"votes">;
export type Nullification = Tables<"nullifications">;
export type ElectionAuthority = Tables<"election_authorities">;
export type ElectionParticipant = Tables<"election_participants">;
export type YesVote = Tables<"yes_votes">;
export type NoVote = Tables<"no_votes">;
