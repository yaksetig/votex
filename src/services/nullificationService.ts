
import { supabase } from "@/integrations/supabase/client";
import { ElGamalCiphertext } from "@/services/elGamalService";

export interface Nullification {
  id: string;
  election_id: string;
  user_id: string;
  nullifier_ciphertext: any; // JSONB data
  created_at: string;
}

// Store a nullification in the database
export async function storeNullification(
  electionId: string,
  userId: string,
  ciphertext: ElGamalCiphertext
): Promise<boolean> {
  try {
    console.log(`Storing nullification for user ${userId} in election ${electionId}`);
    
    // Convert the ciphertext to a JSON format for storage
    const nullifierData = {
      c1: {
        x: ciphertext.c1.x.toString(),
        y: ciphertext.c1.y.toString()
      },
      c2: {
        x: ciphertext.c2.x.toString(),
        y: ciphertext.c2.y.toString()
      },
      r: ciphertext.r.toString(),
      ciphertext: ciphertext.ciphertext.map(c => c.toString())
    };

    const { error } = await supabase
      .from("nullifications")
      .insert({
        election_id: electionId,
        user_id: userId,
        nullifier_ciphertext: nullifierData
      });

    if (error) {
      console.error("Error storing nullification:", error);
      return false;
    }

    console.log("Successfully stored nullification");
    return true;
  } catch (error) {
    console.error("Error in storeNullification:", error);
    return false;
  }
}

// Get nullifications for an election (for election authority use)
export async function getNullificationsForElection(electionId: string): Promise<Nullification[]> {
  try {
    console.log(`Fetching nullifications for election: ${electionId}`);
    
    const { data, error } = await supabase
      .from("nullifications")
      .select("*")
      .eq("election_id", electionId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching nullifications:", error);
      return [];
    }

    console.log(`Found ${data?.length || 0} nullifications for election`);
    return data || [];
  } catch (error) {
    console.error("Error in getNullificationsForElection:", error);
    return [];
  }
}
