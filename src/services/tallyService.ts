import { supabase } from "@/integrations/supabase/client";
import {
  decryptElGamalInExponent,
  ensureDiscreteLogTable,
} from "@/services/elGamalTallyService";
import {
  getElectionAccumulators,
  accumulatorToCiphertext,
} from "@/services/accumulatorService";
import { resolveDelegations } from "@/services/delegationService";
import { getElectionParticipantsForTally } from "@/services/electionParticipantsService";
import { logger } from "@/services/logger";
import { deriveAuthorityKeyMaterial } from "@/services/eddsaService";

export interface TallyResult {
  userId: string;
  nullificationCount: number;
  voteNullified: boolean;
  voteWeight: number;
}

export interface ElectionTallyResult {
  electionId: string;
  results: TallyResult[];
  processedAt: string;
  processedBy?: string;
}

async function getTrackedVoterIds(
  table: "yes_votes" | "no_votes",
  electionId: string
): Promise<string[]> {
  const voterIds: string[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select("voter_id")
      .eq("election_id", electionId)
      .order("voter_id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    voterIds.push(...(data || []).map((row) => row.voter_id));
    if (!data || data.length < pageSize) break;
  }
  return voterIds;
}

async function getElectionAuthorityPublicKey(
  electionId: string
): Promise<{ x: string; y: string }> {
  const { data: election, error: electionError } = await supabase
    .from("public_elections")
    .select("authority_id")
    .eq("id", electionId)
    .maybeSingle();
  if (electionError || !election?.authority_id) {
    throw new Error("Failed to resolve the election authority");
  }

  const { data: authority, error: authorityError } = await supabase
    .from("public_election_authorities")
    .select("public_key_x, public_key_y")
    .eq("id", election.authority_id)
    .maybeSingle();
  if (
    authorityError ||
    !authority?.public_key_x ||
    !authority.public_key_y
  ) {
    throw new Error("Failed to load the election authority key");
  }

  return { x: authority.public_key_x, y: authority.public_key_y };
}

// Process the entire election tally using the authority's secret.
// With XOR accumulators, each voter's accumulator decrypts to either
// 0 (vote valid) or 1 (vote nullified). No count leakage.
export async function processElectionTally(
  electionId: string,
  authoritySecret: string,
  processedBy?: string,
  replaceExisting = false
): Promise<ElectionTallyResult | null> {
  try {
    logger.debug(`Processing election tally for election: ${electionId}`);

    // Ensure discrete log table covers nullification (0/1) plus delegation
    // indices (up to participant count).
    const participants = await getElectionParticipantsForTally(electionId);
    const minTableSize = Math.max(2, participants.length);
    const tableInitialized = await ensureDiscreteLogTable(minTableSize);
    if (!tableInitialized) {
      logger.error("Failed to initialize discrete log table");
      return null;
    }

    // --- Phase 1: Nullification processing ---
    const accumulators = await getElectionAccumulators(electionId);
    logger.debug(
      `Found ${accumulators.length} voter accumulators for election`
    );

    const [authorityKeyMaterial, registeredAuthorityKey] = await Promise.all([
      deriveAuthorityKeyMaterial(authoritySecret),
      getElectionAuthorityPublicKey(electionId),
    ]);
    if (
      authorityKeyMaterial.publicKey.x.toString() !== registeredAuthorityKey.x ||
      authorityKeyMaterial.publicKey.y.toString() !== registeredAuthorityKey.y
    ) {
      throw new Error("Authority secret does not match this election's registered key");
    }
    const privateKey = authorityKeyMaterial.scalar;
    const nullificationMap = new Map<string, { count: number; nullified: boolean }>();

    for (const acc of accumulators) {
      const ciphertext = accumulatorToCiphertext(acc);
      for (const point of [ciphertext.c1, ciphertext.c2]) {
        if (!point.isOnCurve() || !point.isInPrimeSubgroup()) {
          throw new Error(`Accumulator for ${acc.voter_id} contains an invalid point`);
        }
      }
      const decryptedValue = await decryptElGamalInExponent(
        ciphertext,
        privateKey
      );

      if (decryptedValue !== 0 && decryptedValue !== 1) {
        throw new Error(`Accumulator for ${acc.voter_id} could not be decoded safely`);
      }

      const voteNullified = decryptedValue === 1;
      nullificationMap.set(acc.voter_id, {
        count: decryptedValue,
        nullified: voteNullified,
      });

      logger.debug(
        `Voter ${acc.voter_id}: accumulator decrypts to ${decryptedValue}, nullified: ${voteNullified}`
      );
    }

    // --- Phase 2: Delegation resolution ---
    const { weightMap, delegatorIds } = await resolveDelegations(
      electionId,
      privateKey
    );
    logger.debug(
      `Resolved ${delegatorIds.size} delegations across ${weightMap.size} delegates`
    );

    // --- Phase 3: Build final results ---
    const [yesVoterIds, noVoterIds] = await Promise.all([
      getTrackedVoterIds("yes_votes", electionId),
      getTrackedVoterIds("no_votes", electionId),
    ]);

    const allVoterIds = [
      ...yesVoterIds,
      ...noVoterIds,
    ];
    const uniqueVoters = [...new Set(allVoterIds)];

    const results: TallyResult[] = [];

    for (const voterId of uniqueVoters) {
      const nullInfo = nullificationMap.get(voterId);
      const voteNullified = nullInfo?.nullified ?? false;

      // Delegators' direct votes are ignored — their power transferred
      const isDelegator = delegatorIds.has(voterId);

      // Delegates get extra weight from their delegators
      const weight = isDelegator ? 0 : (weightMap.get(voterId) ?? 1);

      results.push({
        userId: voterId,
        nullificationCount: nullInfo?.count ?? 0,
        voteNullified: voteNullified || isDelegator,
        voteWeight: weight,
      });
    }

    // Include delegators who didn't vote directly (they have no
    // yes_votes/no_votes row but should appear in the tally as delegated)
    for (const delegatorId of delegatorIds) {
      if (!uniqueVoters.includes(delegatorId)) {
        results.push({
          userId: delegatorId,
          nullificationCount: 0,
          voteNullified: true, // their power was delegated away
          voteWeight: 0,
        });
      }
    }

    const stored = await storeTallyResults(electionId, results, processedBy, replaceExisting);
    if (!stored) {
      logger.error("Failed to persist tally results through the authority write path");
      return null;
    }

    return {
      electionId,
      results,
      processedAt: new Date().toISOString(),
      processedBy,
    };
  } catch (error) {
    logger.error("Error processing election tally:", error);
    return null;
  }
}

// Store tally results in the database
async function storeTallyResults(
  electionId: string,
  results: TallyResult[],
  processedBy?: string,
  replaceExisting = false
): Promise<boolean> {
  try {
    logger.debug(`Storing tally results for election: ${electionId}`);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      logger.error("Cannot persist tally results without an authenticated authority session");
      return false;
    }

    const { data, error } = await supabase.functions.invoke("authority-tally-write", {
      body: {
        action: replaceExisting ? "replace-results" : "store-results",
        electionId,
        processedBy: processedBy || null,
        results,
      },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error) {
      logger.error("Error storing tally results:", error);
      return false;
    }

    if (data?.error) {
      logger.error("Authority tally write was rejected:", data.error);
      return false;
    }

    logger.debug(`Successfully stored ${results.length} tally results`);
    return true;
  } catch (error) {
    logger.error("Error in storeTallyResults:", error);
    return false;
  }
}

// Get stored tally results for an election
export async function getElectionTallyResults(
  electionId: string
): Promise<TallyResult[]> {
  try {
    logger.debug(`Fetching tally results for election: ${electionId}`);
    const rows: Array<{ user_id: string; nullification_count: number; vote_nullified: boolean; vote_weight: number }> = [];
    const pageSize = 1000;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from("public_tallies")
        .select("voter_pseudonym, nullification_count, vote_nullified, vote_weight")
        .eq("election_id", electionId)
        .order("voter_pseudonym", { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (error) throw error;
      rows.push(...(data || []).flatMap((row) =>
        row.voter_pseudonym !== null && row.nullification_count !== null &&
        row.vote_nullified !== null && row.vote_weight !== null
          ? [{
              user_id: row.voter_pseudonym,
              nullification_count: row.nullification_count,
              vote_nullified: row.vote_nullified,
              vote_weight: row.vote_weight,
            }]
          : []
      ));
      if (!data || data.length < pageSize) break;
    }

    return rows.map((item) => ({
      userId: item.user_id,
      nullificationCount: item.nullification_count,
      voteNullified: item.vote_nullified,
      voteWeight: item.vote_weight ?? 1,
    }));
  } catch (error) {
    logger.error("Error in getElectionTallyResults:", error);
    return [];
  }
}
