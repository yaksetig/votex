
import { supabase } from "@/integrations/supabase/client";

export interface TrustedSetup {
  id: string;
  election_id: string;
  proving_key: any;
  verification_key: any;
  created_at: string;
  created_by: string;
}

// Get trusted setup for an election
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

// Check if trusted setup exists for an election
export async function hasTrustedSetup(electionId: string): Promise<boolean> {
  const setup = await getTrustedSetupForElection(electionId);
  return setup !== null;
}

// Generate and store trusted setup (admin only - will bypass RLS policy manually for now)
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
