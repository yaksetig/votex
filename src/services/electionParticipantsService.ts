
import { supabase } from "@/integrations/supabase/client";
import { StoredKeypair } from "@/types/keypair";
import { getStoredWorldIdSessionToken } from "@/services/worldIdSessionService";
import { logger } from "@/services/logger";
import { readFunctionError } from "@/types/api";

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
  _participantId: string,
  keypair: StoredKeypair
): Promise<boolean> {
  try {
    logger.debug("Registering election participant");

    const sessionToken = getStoredWorldIdSessionToken();
    if (!sessionToken) {
      logger.error("Cannot register participant without a stored voter session");
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
      throw await readFunctionError(
        error,
        "CONFLICT",
        "Failed to register election participant"
      );
    }

    if (!data?.success) {
      logger.error("Participant registration was rejected");
      return false;
    }

    logger.debug("Election participant registered");
    return true;
  } catch (error) {
    logger.error("Error registering election participant", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to register election participant");
  }
}

// Get all participants for an election (needed for nullification)
export async function getElectionParticipants(electionId: string): Promise<ElectionParticipant[]> {
  try {
    logger.debug("Fetching election participants");
    const participants: ElectionParticipant[] = [];
    const pageSize = 1000;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from("public_participants")
        .select("*")
        .eq("election_id", electionId)
        .order("joined_at", { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      participants.push(...(data || []).flatMap((participant) =>
        participant.id && participant.election_id && participant.voter_pseudonym &&
        participant.public_key_x && participant.public_key_y && participant.joined_at
          ? [{
              id: participant.id,
              election_id: participant.election_id,
              participant_id: participant.voter_pseudonym,
              public_key_x: participant.public_key_x,
              public_key_y: participant.public_key_y,
              joined_at: participant.joined_at,
            }]
          : []
      ));
      if (!data || data.length < pageSize) break;
    }

    logger.debug(`Fetched ${participants.length} election participants`);
    return participants;
  } catch (error) {
    logger.error("Error fetching election participants", error);
    return [];
  }
}

// Check if a user is already a participant in an election
export async function isUserParticipant(
  electionId: string,
  participantId: string
): Promise<boolean> {
  try {
    logger.debug("Checking election participant status");
    
    const { data, error } = await supabase
      .from("public_participants")
      .select("id")
      .eq("election_id", electionId)
      .eq("voter_pseudonym", participantId)
      .maybeSingle();

    if (error) {
      logger.error("Error checking participant status", error);
      return false;
    }

    const isParticipant = !!data;
    logger.debug(`Election participant status: ${isParticipant}`);
    return isParticipant;
  } catch (error) {
    logger.error("Error checking election participant status", error);
    return false;
  }
}
