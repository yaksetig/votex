
import { supabase } from "@/integrations/supabase/client";

export interface TrustedSetup {
  id: string;
  election_id: string;
  proving_key?: any; // Legacy field - not used in hybrid approach
  verification_key: any;
  proving_key_hash?: string;
  proving_key_filename?: string;
  created_at: string;
  created_by: string;
}

export interface HybridTrustedSetup {
  id: string;
  election_id: string;
  verification_key: any;
  proving_key_hash: string;
  proving_key_filename: string;
  created_at: string;
  created_by: string;
}

// Get trusted setup for an election (verification key from DB)
export async function getTrustedSetupForElection(electionId: string): Promise<TrustedSetup | null> {
  try {
    console.log(`Fetching trusted setup for election: ${electionId}`);
    
    const { data, error } = await supabase
      .from("election_trusted_setups")
      .select("*")
      .eq("election_id", electionId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching trusted setup:", error);
      return null;
    }

    console.log(`Trusted setup found:`, data ? "Yes" : "No");
    return data;
  } catch (error) {
    console.error("Error in getTrustedSetupForElection:", error);
    return null;
  }
}

// Get proving key from server file system
export async function getProvingKeyFromServer(filename: string): Promise<any> {
  try {
    console.log(`Fetching proving key from server: ${filename}`);
    
    const response = await fetch(`/trusted-setups/${filename}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch proving key: ${response.status} ${response.statusText}`);
    }
    
    const provingKey = await response.json();
    console.log("Proving key fetched successfully from server");
    return provingKey;
  } catch (error) {
    console.error("Error fetching proving key from server:", error);
    throw error;
  }
}

// Verify proving key integrity using stored hash
export async function verifyProvingKeyIntegrity(provingKey: any, expectedHash: string): Promise<boolean> {
  try {
    const provingKeyString = JSON.stringify(provingKey);
    const encoder = new TextEncoder();
    const data = encoder.encode(provingKeyString);
    
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    const isValid = hashHex === expectedHash;
    console.log(`Proving key integrity check: ${isValid ? 'PASSED' : 'FAILED'}`);
    
    return isValid;
  } catch (error) {
    console.error("Error verifying proving key integrity:", error);
    return false;
  }
}

// Get complete trusted setup (verification key from DB + proving key from server)
export async function getCompleteTrustedSetup(electionId: string): Promise<{
  verificationKey: any;
  provingKey: any;
  setup: HybridTrustedSetup;
} | null> {
  try {
    const setup = await getTrustedSetupForElection(electionId);
    
    if (!setup) {
      console.log("No trusted setup found for election");
      return null;
    }

    // Check if this is a hybrid setup (has proving key metadata)
    if (!setup.proving_key_filename || !setup.proving_key_hash) {
      console.log("Legacy setup detected - using proving key from database");
      return {
        verificationKey: setup.verification_key,
        provingKey: setup.proving_key,
        setup: setup as HybridTrustedSetup
      };
    }

    // Fetch proving key from server
    const provingKey = await getProvingKeyFromServer(setup.proving_key_filename);
    
    // Verify proving key integrity
    const isValid = await verifyProvingKeyIntegrity(provingKey, setup.proving_key_hash);
    
    if (!isValid) {
      throw new Error("Proving key integrity check failed - file may be corrupted");
    }

    return {
      verificationKey: setup.verification_key,
      provingKey,
      setup: setup as HybridTrustedSetup
    };
  } catch (error) {
    console.error("Error getting complete trusted setup:", error);
    return null;
  }
}

// Check if trusted setup exists for an election
export async function hasTrustedSetup(electionId: string): Promise<boolean> {
  const setup = await getTrustedSetupForElection(electionId);
  return setup !== null;
}

// Generate SHA-256 hash for a proving key (utility function for manual setup)
export async function generateProvingKeyHash(provingKey: any): Promise<string> {
  const provingKeyString = JSON.stringify(provingKey);
  const encoder = new TextEncoder();
  const data = encoder.encode(provingKeyString);
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex;
}

// Store hybrid trusted setup (verification key in DB, proving key hash/filename)
export async function storeHybridTrustedSetup(
  electionId: string,
  verificationKey: any,
  provingKeyHash: string,
  provingKeyFilename: string,
  createdBy: string
): Promise<boolean> {
  try {
    console.log(`Storing hybrid trusted setup for election: ${electionId}`);
    
    const { error } = await supabase
      .from("election_trusted_setups")
      .insert({
        election_id: electionId,
        verification_key: verificationKey,
        proving_key_hash: provingKeyHash,
        proving_key_filename: provingKeyFilename,
        created_by: createdBy
      });

    if (error) {
      console.error("Error storing hybrid trusted setup:", error);
      return false;
    }

    console.log("Hybrid trusted setup stored successfully");
    return true;
  } catch (error) {
    console.error("Error in storeHybridTrustedSetup:", error);
    return false;
  }
}

// Legacy function - kept for backward compatibility
export async function generateTrustedSetup(electionId: string, createdBy: string): Promise<boolean> {
  try {
    console.log(`Generating trusted setup for election: ${electionId}`);
    
    // For now, we'll use a mock setup. In production, this would be done by trusted admin
    // with proper ceremony and stored securely
    const mockSetup = {
      proving_key: {
        mock: true,
        generated_at: new Date().toISOString(),
        note: "This is a mock setup for development. Production requires proper trusted ceremony."
      },
      verification_key: {
        mock: true,
        generated_at: new Date().toISOString(),
        note: "This is a mock setup for development. Production requires proper trusted ceremony."
      }
    };

    // Note: This will fail due to RLS policy. In production, this would be done
    // through an admin interface with proper permissions
    const { error } = await supabase
      .from("election_trusted_setups")
      .insert({
        election_id: electionId,
        proving_key: mockSetup.proving_key,
        verification_key: mockSetup.verification_key,
        created_by: createdBy
      });

    if (error) {
      console.error("Error storing trusted setup:", error);
      return false;
    }

    console.log("Trusted setup generated and stored successfully");
    return true;
  } catch (error) {
    console.error("Error in generateTrustedSetup:", error);
    return false;
  }
}
