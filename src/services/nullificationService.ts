
import { supabase } from "@/integrations/supabase/client";
import { ElGamalCiphertext } from "@/services/elGamalService";

export interface NullificationProof {
  proof: any;
  publicSignals: string[];
}

export interface Nullification {
  id: string;
  election_id: string;
  user_id: string;
  nullifier_ciphertext: any; // JSONB data
  nullifier_zkp: NullificationProof | null; // PLONK proof with public signals
  created_at: string;
}

// Store a single nullification in the database
export async function storeNullification(
  electionId: string,
  userId: string,
  ciphertext: ElGamalCiphertext,
  zkp?: any // Zero-knowledge proof (optional for now)
): Promise<boolean> {
  try {
    console.log(`Storing nullification for user ${userId} in election ${electionId}`);
    
    // Store only the essential ciphertext data (c1 and c2 points)
    const nullifierData = {
      c1: {
        x: ciphertext.c1.x.toString(),
        y: ciphertext.c1.y.toString()
      },
      c2: {
        x: ciphertext.c2.x.toString(),
        y: ciphertext.c2.y.toString()
      }
    };

    const { error } = await supabase
      .from("nullifications")
      .insert({
        election_id: electionId,
        user_id: userId,
        nullifier_ciphertext: nullifierData,
        nullifier_zkp: zkp || null
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

// Batch store multiple nullifications atomically (for k-anonymity)
export async function storeNullificationBatch(
  electionId: string,
  nullifications: Array<{
    userId: string;
    ciphertext: ElGamalCiphertext;
    zkp: { proof: any; publicSignals: string[] };
  }>
): Promise<boolean> {
  try {
    console.log(`Storing batch of ${nullifications.length} nullifications for election ${electionId}`);

    // Prepare all records
    const records = nullifications.map(n => ({
      election_id: electionId,
      user_id: n.userId,
      nullifier_ciphertext: {
        c1: {
          x: n.ciphertext.c1.x.toString(),
          y: n.ciphertext.c1.y.toString()
        },
        c2: {
          x: n.ciphertext.c2.x.toString(),
          y: n.ciphertext.c2.y.toString()
        }
      },
      nullifier_zkp: n.zkp
    }));

    // Insert all at once for atomicity
    const { error } = await supabase
      .from("nullifications")
      .insert(records);

    if (error) {
      console.error("Error storing nullification batch:", error);
      return false;
    }

    console.log(`Successfully stored batch of ${nullifications.length} nullifications`);
    return true;
  } catch (error) {
    console.error("Error in storeNullificationBatch:", error);
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
