
import { supabase } from "@/integrations/supabase/client";
import { StoredKeypair } from "@/types/keypair";
import { verifyKeypairConsistency } from "@/services/elGamalService";

// Check if a keypair exists in localStorage
export function getStoredKeypair(): StoredKeypair | null {
  const storedKeypair = localStorage.getItem("babyJubKeypair");
  return storedKeypair ? JSON.parse(storedKeypair) : null;
}

// Validate stored keypair against current base point and optionally clear if invalid
export function validateAndMigrateKeypair(): { valid: boolean; cleared: boolean; keypair: StoredKeypair | null } {
  const storedKeypair = getStoredKeypair();
  if (!storedKeypair) {
    return { valid: false, cleared: false, keypair: null };
  }
  
  const isConsistent = verifyKeypairConsistency(storedKeypair);
  if (!isConsistent) {
    localStorage.removeItem("babyJubKeypair");
    console.warn("Cleared outdated keypair - base point mismatch detected");
    return { valid: false, cleared: true, keypair: null };
  }
  
  return { valid: true, cleared: false, keypair: storedKeypair };
}

// Register a keypair in the database
export async function registerKeypair(keypair: StoredKeypair): Promise<boolean> {
  try {
    // Check if keypair is already registered
    const { data: existingKeypair } = await supabase
      .from("keypairs")
      .select("*")
      .eq("public_key_x", keypair.Ax)
      .eq("public_key_y", keypair.Ay)
      .single();
      
    if (existingKeypair) {
      console.log("Keypair already registered");
      return true;
    }
    
    // Register new keypair
    const { error } = await supabase
      .from("keypairs")
      .insert({
        public_key_x: keypair.Ax,
        public_key_y: keypair.Ay
      });
      
    if (error) {
      console.error("Error registering keypair:", error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Error in keypair registration:", error);
    return false;
  }
}
