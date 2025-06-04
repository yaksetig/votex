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

export interface GlobalTrustedSetup {
  id: string;
  name: string;
  description?: string;
  verification_key: any;
  proving_key_hash: string;
  proving_key_filename: string;
  created_at: string;
  created_by: string;
  is_active: boolean;
}

// Read JSON content from a .key file (like verification-key.key)
export async function readKeyFileAsJson(filename: string): Promise<any> {
  try {
    console.log(`Reading .key file as JSON: ${filename}`);
    
    const response = await fetch(`/trusted-setups/${filename}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch .key file: ${response.status} ${response.statusText}`);
    }
    
    const jsonContent = await response.json();
    console.log(`.key file read successfully as JSON: ${filename}`);
    return jsonContent;
    
  } catch (error) {
    console.error(`Error reading .key file as JSON (${filename}):`, error);
    throw error;
  }
}

// Generate hash of a .key file (binary or JSON content)
export async function generateKeyFileHash(filename: string): Promise<string> {
  try {
    console.log(`Generating hash for .key file: ${filename}`);
    
    const response = await fetch(`/trusted-setups/${filename}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch .key file for hashing: ${response.status} ${response.statusText}`);
    }
    
    // Read as array buffer to handle both binary and text content
    const arrayBuffer = await response.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    console.log(`Complete hash generated for ${filename}: ${hashHex}`);
    return hashHex;
    
  } catch (error) {
    console.error(`Error generating hash for .key file (${filename}):`, error);
    throw error;
  }
}

// Setup global trusted setup from .key files in public/trusted-setups/
export async function setupGlobalTrustedSetupFromKeyFiles(
  name: string,
  description: string,
  createdBy: string
): Promise<boolean> {
  try {
    console.log(`Setting up global trusted setup: ${name}`);
    
    // Read verification key JSON from verification-key.key
    const verificationKey = await readKeyFileAsJson('verification-key.key');
    
    // For ZoKrates.js compatibility, we need JSON proving keys, not binary .key files
    // Try to read proving key as JSON first
    let provingKeyData;
    try {
      provingKeyData = await readKeyFileAsJson('proving-key.key');
      console.log("Proving key successfully loaded as JSON format");
    } catch (error) {
      throw new Error("Proving key must be in JSON format for ZoKrates.js compatibility. Binary .key files are not supported.");
    }
    
    // Generate hash of proving-key.key
    const provingKeyHash = await generateKeyFileHash('proving-key.key');
    
    // Store in database with the JSON proving key directly
    const success = await storeGlobalTrustedSetupWithJsonProvingKey(
      name,
      description,
      verificationKey,
      provingKeyData,
      provingKeyHash,
      'proving-key.key',
      createdBy
    );
    
    if (success) {
      console.log('Global trusted setup created successfully from .key files with JSON proving key');
    } else {
      console.error('Failed to store global trusted setup');
    }
    
    return success;
    
  } catch (error) {
    console.error('Error setting up global trusted setup from .key files:', error);
    return false;
  }
}

// Get the active global trusted setup
export async function getActiveTrustedSetup(): Promise<GlobalTrustedSetup | null> {
  try {
    console.log("Fetching active global trusted setup");
    
    const { data, error } = await supabase
      .from("global_trusted_setups")
      .select("*")
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.error("Error fetching active trusted setup:", error);
      return null;
    }

    console.log(`Active trusted setup found:`, data ? "Yes" : "No");
    return data;
  } catch (error) {
    console.error("Error in getActiveTrustedSetup:", error);
    return null;
  }
}

// Backward compatibility: Get trusted setup for an election (will use global setup)
export async function getTrustedSetupForElection(electionId: string): Promise<TrustedSetup | null> {
  try {
    console.log(`Getting trusted setup for election: ${electionId} (using global setup)`);
    
    // First check if there's a legacy election-specific setup
    const { data: legacyData, error: legacyError } = await supabase
      .from("election_trusted_setups")
      .select("*")
      .eq("election_id", electionId)
      .maybeSingle();

    if (legacyError) {
      console.error("Error checking legacy trusted setup:", legacyError);
    }

    if (legacyData) {
      console.log("Using legacy election-specific trusted setup");
      return legacyData;
    }

    // Use global trusted setup
    const globalSetup = await getActiveTrustedSetup();
    if (!globalSetup) {
      console.log("No global trusted setup found");
      return null;
    }

    // Convert global setup to election-specific format for backward compatibility
    return {
      id: globalSetup.id,
      election_id: electionId,
      verification_key: globalSetup.verification_key,
      proving_key_hash: globalSetup.proving_key_hash,
      proving_key_filename: globalSetup.proving_key_filename,
      created_at: globalSetup.created_at,
      created_by: globalSetup.created_by
    };
  } catch (error) {
    console.error("Error in getTrustedSetupForElection:", error);
    return null;
  }
}

// Get proving key from server file system - only supports JSON format for ZoKrates.js compatibility
export async function getProvingKeyFromServer(filename: string): Promise<any> {
  try {
    console.log(`Fetching proving key from server: ${filename}`);
    
    const response = await fetch(`/trusted-setups/${filename}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch proving key: ${response.status} ${response.statusText}`);
    }
    
    // Check if this might be a binary file by trying to parse as JSON first
    try {
      const provingKey = await response.json();
      console.log("JSON proving key fetched successfully from server");
      return provingKey;
    } catch (parseError) {
      throw new Error("Proving key must be in JSON format for ZoKrates.js compatibility. Binary .key files are not supported.");
    }
    
  } catch (error) {
    console.error("Error fetching proving key from server:", error);
    throw error;
  }
}

// Verify proving key integrity using stored hash - supports both binary and JSON data
export async function verifyProvingKeyIntegrity(provingKey: any, expectedHash: string): Promise<boolean> {
  try {
    let data: Uint8Array;
    
    if (provingKey instanceof Uint8Array) {
      // Binary .key file - hash the raw bytes
      console.log("🔍 DEBUG: Verifying integrity of binary .key file");
      data = provingKey;
    } else {
      // JSON file - hash the stringified JSON
      console.log("🔍 DEBUG: Verifying integrity of JSON file");
      const provingKeyString = JSON.stringify(provingKey);
      const encoder = new TextEncoder();
      data = encoder.encode(provingKeyString);
    }
    
    console.log("🔍 DEBUG: Computing hash for integrity check...");
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    console.log("🔍 DEBUG: ===== HASH COMPARISON =====");
    console.log("🔍 DEBUG: Expected hash (from DB):", expectedHash);
    console.log("🔍 DEBUG: Computed hash (from file):", computedHash);
    console.log("🔍 DEBUG: Hashes match:", computedHash === expectedHash);
    console.log("🔍 DEBUG: Expected length:", expectedHash.length);
    console.log("🔍 DEBUG: Computed length:", computedHash.length);
    
    if (computedHash !== expectedHash) {
      console.log("🔍 DEBUG: HASH MISMATCH DETAILS:");
      console.log("🔍 DEBUG: First 32 chars of expected:", expectedHash.substring(0, 32));
      console.log("🔍 DEBUG: First 32 chars of computed:", computedHash.substring(0, 32));
      console.log("🔍 DEBUG: Data size used for hashing:", data.length, "bytes");
    }
    
    const isValid = computedHash === expectedHash;
    console.log(`🔍 DEBUG: Proving key integrity check: ${isValid ? 'PASSED' : 'FAILED'}`);
    
    return isValid;
  } catch (error) {
    console.error("🔍 DEBUG: Error verifying proving key integrity:", error);
    return false;
  }
}

// Get complete trusted setup (verification key from DB + proving key from server) - JSON only
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

    // Check if this is a hybrid setup (has proving key metadata)
    if (!setup.proving_key_filename || !setup.proving_key_hash) {
      console.log("Legacy setup detected - using proving key from database");
      const legacySetup = setup as TrustedSetup;
      
      // Verify legacy setup is not mock
      if (legacySetup.proving_key?.mock) {
        throw new Error("Mock proving key detected in legacy setup - real cryptographic setup is required");
      }
      
      return {
        verificationKey: setup.verification_key,
        provingKey: legacySetup.proving_key,
        setup
      };
    }

    // Fetch proving key from server (JSON format only)
    const provingKey = await getProvingKeyFromServer(setup.proving_key_filename);
    
    // Verify proving key integrity
    const isValid = await verifyProvingKeyIntegrity(provingKey, setup.proving_key_hash);
    
    if (!isValid) {
      throw new Error("Proving key integrity check failed - file may be corrupted");
    }

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

// Check if trusted setup exists (now checks for global setup)
export async function hasTrustedSetup(electionId?: string): Promise<boolean> {
  const setup = electionId ? 
    await getTrustedSetupForElection(electionId) : 
    await getActiveTrustedSetup();
  return setup !== null;
}

// Generate SHA-256 hash for a proving key (utility function for manual setup)
export async function generateProvingKeyHash(provingKey: any): Promise<string> {
  let data: Uint8Array;
  
  if (provingKey instanceof Uint8Array) {
    // Binary .key file
    data = provingKey;
  } else {
    // JSON file
    const provingKeyString = JSON.stringify(provingKey);
    const encoder = new TextEncoder();
    data = encoder.encode(provingKeyString);
  }
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  console.log(`Complete proving key hash generated: ${hashHex}`);
  return hashHex;
}

// Store global trusted setup with JSON proving key directly in database
export async function storeGlobalTrustedSetupWithJsonProvingKey(
  name: string,
  description: string,
  verificationKey: any,
  provingKeyData: any,
  provingKeyHash: string,
  provingKeyFilename: string,
  createdBy: string
): Promise<boolean> {
  try {
    console.log(`Storing global trusted setup with JSON proving key: ${name}`);
    
    // First, deactivate any existing active setups
    await supabase
      .from("global_trusted_setups")
      .update({ is_active: false })
      .eq("is_active", true);
    
    // Store with JSON proving key in a separate field for hybrid approach
    const { error } = await supabase
      .from("global_trusted_setups")
      .insert({
        name,
        description,
        verification_key: verificationKey,
        proving_key: provingKeyData, // Store JSON proving key directly
        proving_key_hash: provingKeyHash,
        proving_key_filename: provingKeyFilename,
        created_by: createdBy,
        is_active: true
      });

    if (error) {
      console.error("Error storing global trusted setup:", error);
      return false;
    }

    console.log("Global trusted setup with JSON proving key stored successfully");
    return true;
  } catch (error) {
    console.error("Error in storeGlobalTrustedSetupWithJsonProvingKey:", error);
    return false;
  }
}

// Store global trusted setup
export async function storeGlobalTrustedSetup(
  name: string,
  description: string,
  verificationKey: any,
  provingKeyHash: string,
  provingKeyFilename: string,
  createdBy: string
): Promise<boolean> {
  try {
    console.log(`Storing global trusted setup: ${name}`);
    
    // First, deactivate any existing active setups
    await supabase
      .from("global_trusted_setups")
      .update({ is_active: false })
      .eq("is_active", true);
    
    const { error } = await supabase
      .from("global_trusted_setups")
      .insert({
        name,
        description,
        verification_key: verificationKey,
        proving_key_hash: provingKeyHash,
        proving_key_filename: provingKeyFilename,
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
    console.error("Error in storeGlobalTrustedSetup:", error);
    return false;
  }
}

// Legacy function - kept for backward compatibility
export async function storeHybridTrustedSetup(
  electionId: string,
  verificationKey: any,
  provingKeyHash: string,
  provingKeyFilename: string,
  createdBy: string
): Promise<boolean> {
  try {
    console.log(`Storing hybrid trusted setup for election: ${electionId} (deprecated - use global setup instead)`);
    
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
    console.log(`Generating trusted setup for election: ${electionId} (deprecated - use global setup instead)`);
    
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
