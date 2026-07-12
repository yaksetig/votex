import { supabase } from "@/integrations/supabase/client";
import { logElectionAuthorityAction } from "@/services/electionAuditService";
import { logger } from "@/services/logger";

export async function closeElectionEarly(electionId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("close_election_atomic", {
    p_election_id: electionId,
  });

  if (error) {
    logger.error("Election closure failed", error);
    return false;
  }

  return data === true;
}

export async function updateElectionDetails(
  electionId: string,
  updates: {
    title?: string;
    description?: string;
    option1?: string;
    option2?: string;
    end_date?: string;
  },
  performedBy: string = "Election Authority"
): Promise<boolean> {
  const { error } = await supabase
    .from("elections")
    .update({ ...updates, last_modified_by: performedBy })
    .eq("id", electionId);

  if (error) {
    logger.error("Election update failed", error);
    return false;
  }

  await logElectionAuthorityAction(electionId, "UPDATE_ELECTION", performedBy, {
    updated_fields: Object.keys(updates),
    updated_at: new Date().toISOString(),
  });
  return true;
}

export async function isElectionSafeToEdit(electionId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("public_votes")
    .select("receipt_id")
    .eq("election_id", electionId)
    .limit(1);

  if (error) {
    logger.error("Vote existence check failed", error);
    return false;
  }

  return (data?.length ?? 0) === 0;
}
