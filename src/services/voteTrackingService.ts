
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/services/logger";
import { getStoredWorldIdSessionToken } from "@/services/worldIdSessionService";

export interface VoteData {
  totalYesVotes: number;
  totalNoVotes: number;
  validYesVotes: number;
  validNoVotes: number;
  nullifiedYesVotes: number;
  nullifiedNoVotes: number;
}

// Get comprehensive vote data for an election using count queries.
// Uses Supabase count aggregates to avoid the default 1000-row limit
// and to avoid transferring full row data just for counting.
export async function getElectionVoteData(electionId: string): Promise<VoteData | null> {
  try {
    logger.debug(`Fetching vote data for election: ${electionId}`);

    const [totalYesResult, nullifiedYesResult, totalNoResult, nullifiedNoResult] =
      await Promise.all([
        supabase
          .from("yes_votes")
          .select("*", { count: "exact", head: true })
          .eq("election_id", electionId),
        supabase
          .from("yes_votes")
          .select("*", { count: "exact", head: true })
          .eq("election_id", electionId)
          .eq("nullified", true),
        supabase
          .from("no_votes")
          .select("*", { count: "exact", head: true })
          .eq("election_id", electionId),
        supabase
          .from("no_votes")
          .select("*", { count: "exact", head: true })
          .eq("election_id", electionId)
          .eq("nullified", true),
      ]);

    const firstError =
      totalYesResult.error || nullifiedYesResult.error ||
      totalNoResult.error || nullifiedNoResult.error;

    if (firstError) {
      logger.error("Error fetching vote counts:", firstError);
      return null;
    }

    const totalYesVotes = totalYesResult.count ?? 0;
    const totalNoVotes = totalNoResult.count ?? 0;
    const nullifiedYesVotes = nullifiedYesResult.count ?? 0;
    const nullifiedNoVotes = nullifiedNoResult.count ?? 0;

    const voteData = {
      totalYesVotes,
      totalNoVotes,
      validYesVotes: totalYesVotes - nullifiedYesVotes,
      validNoVotes: totalNoVotes - nullifiedNoVotes,
      nullifiedYesVotes,
      nullifiedNoVotes
    };

    logger.debug('Vote data calculated:', voteData);

    return voteData;
  } catch (error) {
    logger.error("Error in getElectionVoteData:", error);
    return null;
  }
}

// Cast a vote. The server function validates the World ID session, verifies
// the EdDSA vote signature against the voter's registered key, inserts the
// canonical votes row, and syncs the tracking tables in one call. Throws on
// rejection so the UI can show the server's reason.
export async function castVote(
  electionId: string,
  choice: string,
  signature: string,
  timestamp: number
): Promise<{ voteId: string }> {
  const sessionToken = getStoredWorldIdSessionToken();
  if (!sessionToken) {
    throw new Error("No active voter session; sign in with World ID first");
  }

  const { data, error } = await supabase.functions.invoke("vote-tracking-write", {
    body: {
      action: "cast-vote",
      electionId,
      sessionToken,
      choice,
      signature,
      timestamp,
    },
  });

  if (error) {
    const context = (error as { context?: Response }).context;
    if (context) {
      const body = (await context.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (body?.error) {
        throw new Error(body.error);
      }
    }
    throw new Error(error.message || "Failed to cast vote");
  }

  if (!data?.success || !data?.voteId) {
    throw new Error(data?.error || "Vote was rejected");
  }

  return { voteId: data.voteId };
}

// Sync a canonical vote from the main votes table into the tracking tables.
// The write is performed through a server function that validates the active
// World ID session token and derives the voter id from that session.
export async function recordVote(electionId: string): Promise<boolean> {
  try {
    const sessionToken = getStoredWorldIdSessionToken();
    if (!sessionToken) {
      logger.error("Cannot sync vote tracking without a stored voter session");
      return false;
    }

    logger.debug(`Syncing vote tracking for election=${electionId}`);

    const { data, error } = await supabase.functions.invoke("vote-tracking-write", {
      body: {
        action: "sync-vote",
        electionId,
        sessionToken,
      },
    });

    if (error) {
      logger.error("Error syncing vote tracking:", error);
      return false;
    }

    if (data?.error) {
      logger.error("Vote tracking sync was rejected:", data.error);
      return false;
    }

    logger.debug("Vote tracking synced successfully");
    return true;
  } catch (error) {
    logger.error("Error in recordVote:", error);
    return false;
  }
}
