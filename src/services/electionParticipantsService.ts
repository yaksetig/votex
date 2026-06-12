
import { supabase } from "@/integrations/supabase/client";
import { StoredKeypair } from "@/types/keypair";
import { getStoredWorldIdSessionToken } from "@/services/worldIdSessionService";

export interface ElectionParticipant {
  id: string;
  election_id: string;
  public_key_x: string;
  public_key_y: string;
  participant_id: string;
  joined_at: string;
}

// Register a user as a participant in an election. The write goes through
// the register-participant edge function, which validates the World ID
// session and enforces that the key matches the registered keypair binding;
// direct client writes to election_participants are blocked by RLS.
export async function registerElectionParticipant(
  electionId: string,
  participantId: string,
  keypair: StoredKeypair
): Promise<boolean> {
  try {
    console.log(`Attempting to register participant ${participantId} for election ${electionId}`);

    const sessionToken = getStoredWorldIdSessionToken();
    if (!sessionToken) {
      console.error("Cannot register participant without a stored voter session");
      return false;
    }

    const { data, error } = await supabase.functions.invoke("register-participant", {
      body: {
        electionId,
        sessionToken,
        publicKey: { x: keypair.Ax, y: keypair.Ay },
      },
    });

    if (error) {
      // supabase-js surfaces non-2xx responses as FunctionsHttpError with the
      // JSON body available on the response object.
      const context = (error as { context?: Response }).context;
      if (context) {
        const body = (await context.json().catch(() => null)) as
          | { error?: string }
          | null;
        if (body?.error) {
          throw new Error(body.error);
        }
      }

      console.error("Error registering election participant:", error);
      return false;
    }

    if (!data?.success) {
      console.error("Participant registration was rejected:", data);
      return false;
    }

    console.log("Successfully registered participant");
    return true;
  } catch (error) {
    console.error("Error in registerElectionParticipant:", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to register election participant");
  }
}

// Get all participants for an election (needed for nullification)
export async function getElectionParticipants(electionId: string): Promise<ElectionParticipant[]> {
  try {
    console.log(`Fetching participants for election: ${electionId}`);
    
    const { data, error } = await supabase
      .from("election_participants")
      .select("*")
      .eq("election_id", electionId)
      .order("joined_at", { ascending: true });

    if (error) {
      console.error("Error fetching election participants:", error);
      return [];
    }

    console.log(`Found ${data?.length || 0} participants:`, data);
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
    console.log(`Checking if user ${participantId} is participant in election ${electionId}`);
    
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

    const isParticipant = !!data;
    console.log(`User is participant: ${isParticipant}`);
    return isParticipant;
  } catch (error) {
    console.error("Error in isUserParticipant:", error);
    return false;
  }
}
