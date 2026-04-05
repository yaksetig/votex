/**
 * Delegation Service — Kite-inspired private vote delegation.
 *
 * A delegator encrypts the participant index of their chosen delegate
 * using the election authority's ElGamal public key.  The ciphertext is
 * stored publicly so anyone can see "this voter delegated", but only
 * the authority can decrypt to learn WHO they delegated to.
 *
 * At tally time the authority decrypts every active delegation, builds
 * a weight map, and counts each delegate's vote with extra weight.
 */

import { supabase } from "@/integrations/supabase/client";
import {
  EdwardsPoint,
  elgamalEncrypt,
  ElGamalCiphertext,
} from "@/services/elGamalService";
import { decryptElGamalInExponent } from "@/services/elGamalTallyService";
import { getElectionParticipants, ElectionParticipant } from "@/services/electionParticipantsService";
import { logger } from "@/services/logger";

interface StoredDelegation {
  id: string;
  election_id: string;
  delegator_id: string;
  delegate_ct_c1_x: string;
  delegate_ct_c1_y: string;
  delegate_ct_c2_x: string;
  delegate_ct_c2_y: string;
  status: string;
  created_at: string;
  revoked_at: string | null;
}

interface DelegationResolution {
  delegatorId: string;
  delegateIndex: number;
  delegateParticipantId: string;
}

// -----------------------------------------------------------------------
// Write operations
// -----------------------------------------------------------------------

/**
 * Create a private delegation.
 *
 * @param electionId     Election to delegate within
 * @param delegatorId    World ID nullifier hash of the delegator
 * @param delegateIndex  Index of the delegate in the ordered participant list
 * @param authorityPk    Election authority's ElGamal public key
 */
export async function createDelegation(
  electionId: string,
  delegatorId: string,
  delegateIndex: number,
  authorityPk: EdwardsPoint
): Promise<boolean> {
  try {
    logger.debug(
      `Creating delegation: election=${electionId}, delegator=${delegatorId}, index=${delegateIndex}`
    );

    // Encrypt the delegate index with the authority's public key
    const ct = elgamalEncrypt(authorityPk, delegateIndex);

    const { error } = await supabase.from("delegations").insert({
      election_id: electionId,
      delegator_id: delegatorId,
      delegate_ct_c1_x: ct.c1.x.toString(),
      delegate_ct_c1_y: ct.c1.y.toString(),
      delegate_ct_c2_x: ct.c2.x.toString(),
      delegate_ct_c2_y: ct.c2.y.toString(),
    });

    if (error) {
      logger.error("Error creating delegation:", error);
      return false;
    }

    logger.debug("Delegation created successfully");
    return true;
  } catch (error) {
    logger.error("Error in createDelegation:", error);
    return false;
  }
}

/**
 * Revoke an active delegation so the voter can vote directly again.
 */
export async function revokeDelegation(
  electionId: string,
  delegatorId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("delegations")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
      })
      .eq("election_id", electionId)
      .eq("delegator_id", delegatorId)
      .eq("status", "active");

    if (error) {
      logger.error("Error revoking delegation:", error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error("Error in revokeDelegation:", error);
    return false;
  }
}

// -----------------------------------------------------------------------
// Read operations
// -----------------------------------------------------------------------

/**
 * Check whether a voter has an active delegation for an election.
 */
export async function getActiveDelegation(
  electionId: string,
  delegatorId: string
): Promise<StoredDelegation | null> {
  try {
    const { data, error } = await supabase
      .from("delegations")
      .select("*")
      .eq("election_id", electionId)
      .eq("delegator_id", delegatorId)
      .eq("status", "active")
      .maybeSingle();

    if (error) {
      logger.error("Error fetching active delegation:", error);
      return null;
    }

    return data as StoredDelegation | null;
  } catch (error) {
    logger.error("Error in getActiveDelegation:", error);
    return null;
  }
}

/**
 * Fetch all active delegations for an election (used at tally time).
 */
async function getElectionDelegations(
  electionId: string
): Promise<StoredDelegation[]> {
  try {
    const { data, error } = await supabase
      .from("delegations")
      .select("*")
      .eq("election_id", electionId)
      .eq("status", "active");

    if (error) {
      logger.error("Error fetching election delegations:", error);
      return [];
    }

    return (data || []) as StoredDelegation[];
  } catch (error) {
    logger.error("Error in getElectionDelegations:", error);
    return [];
  }
}

// -----------------------------------------------------------------------
// Tally-time operations (authority only)
// -----------------------------------------------------------------------

/**
 * Reconstruct an ElGamalCiphertext from stored delegation coordinates.
 */
function delegationToCiphertext(d: StoredDelegation): ElGamalCiphertext {
  const c1 = new EdwardsPoint(
    BigInt(d.delegate_ct_c1_x),
    BigInt(d.delegate_ct_c1_y)
  );
  const c2 = new EdwardsPoint(
    BigInt(d.delegate_ct_c2_x),
    BigInt(d.delegate_ct_c2_y)
  );
  return { c1, c2, r: 0n, ciphertext: [c1.x, c1.y, c2.x, c2.y] };
}

/**
 * Decrypt all delegations for an election and resolve delegate identities.
 *
 * Returns a list of resolved delegations and a weight map:
 *   delegateParticipantId → total voting weight (1 + delegators count)
 */
export async function resolveDelegations(
  electionId: string,
  authorityPrivateKey: bigint
): Promise<{
  resolved: DelegationResolution[];
  weightMap: Map<string, number>;
  delegatorIds: Set<string>;
}> {
  const delegations = await getElectionDelegations(electionId);
  const participants = await getElectionParticipants(electionId);

  // Sort participants by joined_at for stable index mapping
  const sorted = [...participants].sort(
    (a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
  );

  const resolved: DelegationResolution[] = [];
  const weightMap = new Map<string, number>();
  const delegatorIds = new Set<string>();

  for (const d of delegations) {
    const ct = delegationToCiphertext(d);
    const index = await decryptElGamalInExponent(ct, authorityPrivateKey);

    if (index === null || index < 0 || index >= sorted.length) {
      logger.warn(
        `Failed to resolve delegation from ${d.delegator_id}: decrypted index=${index}`
      );
      continue;
    }

    const delegate = sorted[index];
    resolved.push({
      delegatorId: d.delegator_id,
      delegateIndex: index,
      delegateParticipantId: delegate.participant_id,
    });

    delegatorIds.add(d.delegator_id);
    const current = weightMap.get(delegate.participant_id) ?? 1;
    weightMap.set(delegate.participant_id, current + 1);
  }

  // Ensure every voter who didn't receive delegation has weight 1
  // (weightMap only contains delegates who received at least one delegation)

  return { resolved, weightMap, delegatorIds };
}
