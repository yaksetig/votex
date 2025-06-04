
import { supabase } from "@/integrations/supabase/client";

export interface TrustedSetup {
  id: string;
  election_id: string;
  proving_key?: any; // Legacy field - not used in hybrid approach
  verification_key: any;
  proving_key_url?: string; // New field for Firebase URL
  proving_key_hash?: string; // Legacy field - optional now
  proving_key_filename?: string; // Legacy field - optional now
  created_at: string;
  created_by: string;
}

export interface GlobalTrustedSetup {
  id: string;
  name: string;
  description?: string;
  verification_key: any;
  proving_key_url?: string; // New field for Firebase URL
  proving_key_hash?: string; // Legacy field - optional now
  proving_key_filename?: string; // Legacy field - optional now
  created_at: string;
  created_by: string;
  is_active: boolean;
}

// New function to fetch proving key from Firebase URL (no access token needed - URL has token)
export async function getProvingKeyFromFirebase(url: string): Promise<any> {
  try {
    console.log(`Fetching proving key from Firebase: ${url}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch proving key from Firebase: ${response.status} ${response.statusText}`);
    }
    
    const provingKey = await response.json();
    console.log("JSON proving key fetched successfully from Firebase");
    return provingKey;
    
  } catch (error) {
    console.error("Error fetching proving key from Firebase:", error);
    throw error;
  }
}

// Legacy function to fetch proving key from server file system
export async function getProvingKeyFromServer(filename: string): Promise<any> {
  try {
    console.log(`Fetching proving key from server: ${filename}`);
    
    // This is legacy and expects JSON format
    throw new Error("Proving key must be in JSON format for ZoKrates.js compatibility. Binary .key files are not supported.");
    
  } catch (error) {
    console.error("Error fetching proving key from server:", error);
    throw error;
  }
}

// Updated function to get proving key from either server or Firebase (no access token needed)
export async function getProvingKeyFromSource(setup: GlobalTrustedSetup | TrustedSetup): Promise<any> {
  try {
    // Check if we have a Firebase URL (priority)
    if (setup.proving_key_url) {
      console.log("Using Firebase URL for proving key (JSON format confirmed)");
      return await getProvingKeyFromFirebase(setup.proving_key_url);
    }
    
    // Check for legacy setup with proving key in database
    const legacySetup = setup as TrustedSetup;
    if (legacySetup.proving_key) {
      console.log("Using legacy proving key from database");
      return legacySetup.proving_key;
    }
    
    // Fallback to server file system (legacy) - but Firebase should be preferred
    if (setup.proving_key_filename) {
      console.log("Falling back to server file system (legacy approach)");
      return await getProvingKeyFromServer(setup.proving_key_filename);
    }
    
    throw new Error("No proving key source found - neither URL, filename, nor legacy key available");
    
  } catch (error) {
    console.error("Error getting proving key from source:", error);
    throw error;
  }
}

// Get active global trusted setup
export async function getActiveTrustedSetup(): Promise<GlobalTrustedSetup | null> {
  try {
    const { data, error } = await supabase
      .from("global_trusted_setups")
      .select("*")
      .eq("is_active", true)
      .single();

    if (error) {
      console.error("Error fetching active trusted setup:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Error in getActiveTrustedSetup:", error);
    return null;
  }
}

// Get trusted setup for specific election (fallback to global)
export async function getTrustedSetupForElection(electionId: string): Promise<TrustedSetup | GlobalTrustedSetup | null> {
  try {
    // First try election-specific setup
    const { data: electionSetup, error: electionError } = await supabase
      .from("election_trusted_setups")
      .select("*")
      .eq("election_id", electionId)
      .single();

    if (!electionError && electionSetup) {
      return electionSetup;
    }

    // Fallback to global setup
    return await getActiveTrustedSetup();
  } catch (error) {
    console.error("Error in getTrustedSetupForElection:", error);
    return null;
  }
}

// Check if trusted setup exists (election-specific or global)
export async function hasTrustedSetup(electionId?: string): Promise<boolean> {
  try {
    if (electionId) {
      const setup = await getTrustedSetupForElection(electionId);
      return setup !== null;
    } else {
      const globalSetup = await getActiveTrustedSetup();
      return globalSetup !== null;
    }
  } catch (error) {
    console.error("Error checking trusted setup:", error);
    return false;
  }
}

// Get complete trusted setup (verification key from DB + proving key from Firebase/server)
export async function getCompleteTrustedSetup(electionId?: string): Promise<{
  verificationKey: any;
  provingKey: any;
  setup: GlobalTrustedSetup | TrustedSetup;
} | null> {
  try {
    let setup: TrustedSetup | GlobalTrustedSetup | null;

    if (electionId) {
      // Try election-specific first for backward compatibility
      setup = await getTrustedSetupForElection(electionId);
    } else {
      // Use global setup directly
      setup = await getActiveTrustedSetup();
    }
    
    if (!setup) {
      console.log("No trusted setup found");
      return null;
    }

    // Get proving key from appropriate source (Firebase preferred, no access token needed)
    const provingKey = await getProvingKeyFromSource(setup);
    
    // Verify it's not a mock setup
    if (provingKey?.mock) {
      throw new Error("Mock proving key detected - real cryptographic setup is required");
    }

    console.log("Complete trusted setup retrieved successfully");
    return {
      verificationKey: setup.verification_key,
      provingKey,
      setup
    };
  } catch (error) {
    console.error("Error getting complete trusted setup:", error);
    return null;
  }
}

// Store global trusted setup with Firebase URL
export async function storeGlobalTrustedSetupWithFirebaseUrl(
  name: string,
  description: string,
  verificationKey: any,
  firebaseUrl: string,
  createdBy: string
): Promise<boolean> {
  try {
    // Deactivate existing setups
    await supabase
      .from("global_trusted_setups")
      .update({ is_active: false })
      .eq("is_active", true);

    // Insert new setup
    const { error } = await supabase
      .from("global_trusted_setups")
      .insert({
        name,
        description,
        verification_key: verificationKey,
        proving_key_url: firebaseUrl,
        created_by: createdBy,
        is_active: true
      });

    if (error) {
      console.error("Error storing global trusted setup:", error);
      return false;
    }

    console.log("Global trusted setup stored successfully");
    return true;
  } catch (error) {
    console.error("Error in storeGlobalTrustedSetupWithFirebaseUrl:", error);
    return false;
  }
}

// Setup global trusted setup from key files (legacy)
export async function setupGlobalTrustedSetupFromKeyFiles(
  name: string,
  description: string,
  verificationKeyPath: string,
  provingKeyPath: string,
  createdBy: string
): Promise<boolean> {
  try {
    console.log("Legacy setup from key files - not recommended for production");
    return false;
  } catch (error) {
    console.error("Error in setupGlobalTrustedSetupFromKeyFiles:", error);
    return false;
  }
}
