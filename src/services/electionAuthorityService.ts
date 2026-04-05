
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
      .from("election_authorities")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("Error fetching election authorities:", error);
      return [];
    }

    logger.debug(`Found ${data?.length || 0} election authorities:`, data);
    return data || [];
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
      .from("elections")
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
        .from("election_authorities")
        .select("*")
        .eq("id", electionData.authority_id)
        .maybeSingle();
        
      if (authorityError) {
        logger.error("Error fetching election authority by ID:", authorityError);
        return null;
      }
      
      if (authorityData) {
        logger.debug("Found election authority for election:", authorityData);
        return authorityData;
      }
    }
    
    // If no specific authority is assigned, get the default one
    logger.debug("No specific authority assigned, fetching default authority");
    
    // First ensure default authority exists
    await initializeDefaultElectionAuthority();
    
    // Then fetch the default authority
    const { data: defaultAuthority, error: defaultError } = await supabase
      .from("election_authorities")
      .select("*")
      .eq("name", "Default Election Authority")
      .maybeSingle();
      
    if (defaultError) {
      logger.error("Error fetching default election authority:", defaultError);
      return null;
    }
    
    if (!defaultAuthority) {
      logger.error("Default election authority not found after initialization");
      return null;
    }
    
    logger.debug("Using default election authority:", defaultAuthority);
    return defaultAuthority;
  } catch (error) {
    logger.error("Error in getElectionAuthorityForElection:", error);
    return null;
  }
}

// Initialize default election authority with the provided public key
// CRITICAL: These public key values MUST match a keypair generated with the
// circomlib standard BabyJubJub generator (see elGamalService.ts BASE_POINT)
// Using sk=1, so pk = G (the generator point itself)
export async function initializeDefaultElectionAuthority(): Promise<void> {
  try {
    logger.debug("Initializing default election authority");
    
    const existingAuthorities = await getElectionAuthorities();
    
    // Check if we already have the default authority
    const defaultExists = existingAuthorities.some(
      auth => auth.name === "Default Election Authority"
    );
    
    if (!defaultExists) {
      logger.warn("Default election authority is missing; expected to be bootstrapped by database migrations");
    } else {
      logger.debug("Default election authority already exists");
    }
  } catch (error) {
    logger.error("Error initializing default election authority:", error);
  }
}
