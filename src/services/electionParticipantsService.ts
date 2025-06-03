
import { supabase } from "@/integrations/supabase/client";
import { StoredKeypair } from "@/types/keypair";

export interface ElectionParticipant {
  id: string;
  election_id: string;
  public_key_x: string;
  public_key_y: string;
  participant_id: string;
  joined_at: string;
}

// Register a user as a participant in an election
export async function registerElectionParticipant(
  electionId: string,
  participantId: string,
  keypair: StoredKeypair
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("election_participants")
      .insert({
        election_id: electionId,
        participant_id: participantId,
        public_key_x: keypair.Ax,
        public_key_y: keypair.Ay
      });

    if (error) {
      // If it's a unique constraint violation, that's okay - user already registered
      if (error.code === '23505') {
        console.log("User already registered as participant for this election");
        return true;
      }
      console.error("Error registering election participant:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error in registerElectionParticipant:", error);
    return false;
  }
}

// Get all participants for an election (needed for nullification)
export async function getElectionParticipants(electionId: string): Promise<ElectionParticipant[]> {
  try {
    const { data, error } = await supabase
      .from("election_participants")
      .select("*")
      .eq("election_id", electionId)
      .order("joined_at", { ascending: true });

    if (error) {
      console.error("Error fetching election participants:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Error in getElectionParticipants:", error);
    return [];
  }
}

// Check if a user is already a participant in an election
export async function isUserParticipant(
  electionId: string,
  participantId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("election_participants")
      .select("id")
      .eq("election_id", electionId)
      .eq("participant_id", participantId)
      .maybeSingle();

    if (error) {
      console.error("Error checking participant status:", error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error("Error in isUserParticipant:", error);
    return false;
  }
}
