
import { supabase } from "@/integrations/supabase/client";
import { StoredKeypair } from "@/types/keypair";

export interface ElectionAuthority {
  id: string;
  name: string;
  description: string | null;
  public_key_x: string;
  public_key_y: string;
  created_at: string;
  updated_at: string;
}

// Create a new election authority
export async function createElectionAuthority(
  name: string,
  description: string,
  keypair: StoredKeypair
): Promise<ElectionAuthority | null> {
  try {
    console.log(`Creating election authority: ${name}`);
    
    const { data, error } = await supabase
      .from("election_authorities")
      .insert({
        name,
        description,
        public_key_x: keypair.Ax,
        public_key_y: keypair.Ay
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating election authority:", error);
      return null;
    }

    console.log("Successfully created election authority:", data);
    return data;
  } catch (error) {
    console.error("Error in createElectionAuthority:", error);
    return null;
  }
}

// Create election authority with raw public key coordinates
export async function createElectionAuthorityWithPublicKey(
  name: string,
  description: string,
  publicKeyX: string,
  publicKeyY: string
): Promise<ElectionAuthority | null> {
  try {
    console.log(`Creating election authority with public key: ${name}`);
    
    const { data, error } = await supabase
      .from("election_authorities")
      .insert({
        name,
        description,
        public_key_x: publicKeyX,
        public_key_y: publicKeyY
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating election authority:", error);
      return null;
    }

    console.log("Successfully created election authority:", data);
    return data;
  } catch (error) {
    console.error("Error in createElectionAuthorityWithPublicKey:", error);
    return null;
  }
}

// Get all election authorities
export async function getElectionAuthorities(): Promise<ElectionAuthority[]> {
  try {
    console.log("Fetching all election authorities");
    
    const { data, error } = await supabase
      .from("election_authorities")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching election authorities:", error);
      return [];
    }

    console.log(`Found ${data?.length || 0} election authorities:`, data);
    return data || [];
  } catch (error) {
    console.error("Error in getElectionAuthorities:", error);
    return [];
  }
}

// Get election authority by ID
export async function getElectionAuthorityById(id: string): Promise<ElectionAuthority | null> {
  try {
    console.log(`Fetching election authority with ID: ${id}`);
    
    const { data, error } = await supabase
      .from("election_authorities")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching election authority:", error);
      return null;
    }

    console.log("Found election authority:", data);
    return data;
  } catch (error) {
    console.error("Error in getElectionAuthorityById:", error);
    return null;
  }
}

// Get election authority for a specific election
export async function getElectionAuthorityForElection(electionId: string): Promise<ElectionAuthority | null> {
  try {
    console.log(`Fetching election authority for election: ${electionId}`);
    
    // First, fetch the election to get the authority_id
    const { data: electionData, error: electionError } = await supabase
      .from("elections")
      .select("authority_id")
      .eq("id", electionId)
      .maybeSingle();

    if (electionError) {
      console.error("Error fetching election:", electionError);
      return null;
    }

    if (!electionData) {
      console.error("Election not found:", electionId);
      return null;
    }

    // If the election has a specific authority assigned, fetch it
    if (electionData.authority_id) {
      console.log(`Fetching authority by ID: ${electionData.authority_id}`);
      
      const { data: authorityData, error: authorityError } = await supabase
        .from("election_authorities")
        .select("*")
        .eq("id", electionData.authority_id)
        .maybeSingle();
        
      if (authorityError) {
        console.error("Error fetching election authority by ID:", authorityError);
        return null;
      }
      
      if (authorityData) {
        console.log("Found election authority for election:", authorityData);
        return authorityData;
      }
    }
    
    // If no specific authority is assigned, get the default one
    console.log("No specific authority assigned, fetching default authority");
    
    // First ensure default authority exists
    await initializeDefaultElectionAuthority();
    
    // Then fetch the default authority
    const { data: defaultAuthority, error: defaultError } = await supabase
      .from("election_authorities")
      .select("*")
      .eq("name", "Default Election Authority")
      .maybeSingle();
      
    if (defaultError) {
      console.error("Error fetching default election authority:", defaultError);
      return null;
    }
    
    if (!defaultAuthority) {
      console.error("Default election authority not found after initialization");
      return null;
    }
    
    console.log("Using default election authority:", defaultAuthority);
    return defaultAuthority;
  } catch (error) {
    console.error("Error in getElectionAuthorityForElection:", error);
    return null;
  }
}

// Update election authority
export async function updateElectionAuthority(
  id: string,
  updates: Partial<Pick<ElectionAuthority, 'name' | 'description'>>
): Promise<boolean> {
  try {
    console.log(`Updating election authority ${id}:`, updates);
    
    const { error } = await supabase
      .from("election_authorities")
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq("id", id);

    if (error) {
      console.error("Error updating election authority:", error);
      return false;
    }

    console.log("Successfully updated election authority");
    return true;
  } catch (error) {
    console.error("Error in updateElectionAuthority:", error);
    return false;
  }
}

// Delete election authority
export async function deleteElectionAuthority(id: string): Promise<boolean> {
  try {
    console.log(`Deleting election authority: ${id}`);
    
    const { error } = await supabase
      .from("election_authorities")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting election authority:", error);
      return false;
    }

    console.log("Successfully deleted election authority");
    return true;
  } catch (error) {
    console.error("Error in deleteElectionAuthority:", error);
    return false;
  }
}

// Initialize default election authority with the provided public key
// CRITICAL: These public key values MUST match a keypair generated with the
// circomlib standard BabyJubJub generator (see elGamalService.ts BASE_POINT)
// Using sk=1, so pk = G (the generator point itself)
export async function initializeDefaultElectionAuthority(): Promise<void> {
  try {
    console.log("Initializing default election authority");
    
    const existingAuthorities = await getElectionAuthorities();
    
    // Check if we already have the default authority
    const defaultExists = existingAuthorities.some(
      auth => auth.name === "Default Election Authority"
    );
    
    if (!defaultExists) {
      await createElectionAuthorityWithPublicKey(
        "Default Election Authority",
        "Primary election authority for the platform",
        "5299619240641551281634865583518297030282874472190772894086521144482721001553",
        "16950150798460657717958625567821834550301663161624707787222815936182638968203"
      );
      console.log("Default election authority created successfully");
    } else {
      console.log("Default election authority already exists");
    }
  } catch (error) {
    console.error("Error initializing default election authority:", error);
  }
}
