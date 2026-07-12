
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/services/logger";

export interface ElectionAuthority {
  id: string;
  name: string;
  description: string | null;
  public_key_x: string;
  public_key_y: string;
  created_at: string;
  updated_at: string;
}

// Get all election authorities
export async function getElectionAuthorities(): Promise<ElectionAuthority[]> {
  try {
    logger.debug("Fetching all election authorities");
    
    const { data, error } = await supabase
      .from("public_election_authorities")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("Error fetching election authorities:", error);
      return [];
    }

    logger.debug(`Found ${data?.length || 0} election authorities:`, data);
    return (data || []).filter(
      (authority): authority is ElectionAuthority =>
        Boolean(
          authority.id && authority.name && authority.public_key_x &&
          authority.public_key_y && authority.created_at && authority.updated_at
        )
    );
  } catch (error) {
    logger.error("Error in getElectionAuthorities:", error);
    return [];
  }
}

// Get election authority for a specific election
export async function getElectionAuthorityForElection(electionId: string): Promise<ElectionAuthority | null> {
  try {
    logger.debug(`Fetching election authority for election: ${electionId}`);
    
    // First, fetch the election to get the authority_id
    const { data: electionData, error: electionError } = await supabase
      .from("public_elections")
      .select("authority_id")
      .eq("id", electionId)
      .maybeSingle();

    if (electionError) {
      logger.error("Error fetching election:", electionError);
      return null;
    }

    if (!electionData) {
      logger.error("Election not found:", electionId);
      return null;
    }

    // If the election has a specific authority assigned, fetch it
    if (electionData.authority_id) {
      logger.debug(`Fetching authority by ID: ${electionData.authority_id}`);
      
      const { data: authorityData, error: authorityError } = await supabase
        .from("public_election_authorities")
        .select("*")
        .eq("id", electionData.authority_id)
        .maybeSingle();
        
      if (authorityError) {
        logger.error("Error fetching election authority by ID:", authorityError);
        return null;
      }
      
      if (authorityData) {
        logger.debug("Found election authority for election:", authorityData);
        return authorityData as ElectionAuthority;
      }
    }
    
    logger.error("Election has no configured authority", electionId);
    return null;
  } catch (error) {
    logger.error("Error in getElectionAuthorityForElection:", error);
    return null;
  }
}
