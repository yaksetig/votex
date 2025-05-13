
import { supabase } from "@/integrations/supabase/client";
import { StoredKeypair } from "@/types/keypair";

// Register the keypair in the database
export async function registerKeypair(keypair: StoredKeypair): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('keypairs')
      .insert([
        { 
          public_key_x: keypair.Ax,
          public_key_y: keypair.Ay
        }
      ]);
    
    if (error) {
      if (error.code === '23505') { // Unique violation code
        console.log('This keypair is already registered');
        return false;
      }
      throw error;
    }
    
    return true;
  } catch (error) {
    console.error('Error registering keypair:', error);
    throw error;
  }
}

// Check if keypair is already registered
export async function isKeypairRegistered(keypair: StoredKeypair): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('keypairs')
      .select('id')
      .eq('public_key_x', keypair.Ax)
      .eq('public_key_y', keypair.Ay)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      throw error;
    }
    
    return !!data;
  } catch (error) {
    console.error('Error checking keypair registration:', error);
    throw error;
  }
}
