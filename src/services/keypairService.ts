
import { supabase } from "@/integrations/supabase/client";
import { StoredKeypair } from "@/types/keypair";

// Check if a keypair exists in localStorage
export function getStoredKeypair(): StoredKeypair | null {
  const storedKeypair = localStorage.getItem("babyJubKeypair");
  return storedKeypair ? JSON.parse(storedKeypair) : null;
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
