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

// ... keep existing code (all other functions remain the same)
