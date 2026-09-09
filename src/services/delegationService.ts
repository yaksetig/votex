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
import { getElectionParticipantsForTally } from "@/services/electionParticipantsService";
import { getStoredWorldIdSessionToken } from "@/services/worldIdSessionService";
import { logger } from "@/services/logger";
import { signMessageWithStoredSeed } from "@/services/eddsaService";
import type { StoredKeypair } from "@/types/keypair";
import { parseCanonicalFieldElement } from "@/services/crypto/utils";

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

export interface DelegationCiphertextStrings {
  c1: { x: string; y: string };
  c2: { x: string; y: string };
}

export interface DelegationAuthorization {
  issuedAt: number;
  signature: string;
}

/**
 * Domain-separated message the delegator signs. Must match
 * supabase/functions/_shared/delegation.ts.
 */
export function buildDelegationMessage(
  action: "create" | "revoke",
  electionId: string,
  issuedAt: number,
  ciphertext?: DelegationCiphertextStrings
): string {
  const parts = ["votex:delegation:v1", action, electionId];
  if (action === "create") {
    if (!ciphertext) {
      throw new Error("create delegation message requires a ciphertext");
    }
    parts.push(ciphertext.c1.x, ciphertext.c1.y, ciphertext.c2.x, ciphertext.c2.y);
  }
  parts.push(issuedAt.toString());
  return parts.join(":");
}

export async function createDelegationAuthorization(
  keypair: StoredKeypair,
  action: "create" | "revoke",
  electionId: string,
  ciphertext?: DelegationCiphertextStrings
): Promise<DelegationAuthorization> {
  if (!keypair.seed) {
    throw new Error("Voting key seed is unavailable; sign in again to delegate");
  }
  const issuedAt = Date.now();
  const message = buildDelegationMessage(action, electionId, issuedAt, ciphertext);
  const signature = await signMessageWithStoredSeed(keypair.seed, message);
  return { issuedAt, signature: JSON.stringify(signature) };
}

/**
 * Create a private delegation.
 *
 * The write goes through the delegation-write edge function; the delegator
 * identity comes from the validated World ID session, never the client.
 *
 * @param electionId     Election to delegate within
 * @param delegateIndex  Index of the delegate in the ordered participant list
 * @param authorityPk    Election authority's ElGamal public key
 */
export async function createDelegation(
  electionId: string,
  delegateIndex: number,
  authorityPk: EdwardsPoint,
  keypair: StoredKeypair
): Promise<boolean> {
  try {
    logger.debug(
      `Creating delegation: election=${electionId}, index=${delegateIndex}`
    );

    const sessionToken = getStoredWorldIdSessionToken();
    if (!sessionToken) {
      logger.error("Cannot create delegation without a stored voter session");
      return false;
    }

    // Encrypt the delegate index with the authority's public key
    const ct = elgamalEncrypt(authorityPk, delegateIndex);
    const ciphertext = {
      c1: { x: ct.c1.x.toString(), y: ct.c1.y.toString() },
      c2: { x: ct.c2.x.toString(), y: ct.c2.y.toString() },
    };

    // A session alone must not be able to delegate a ballot away: sign the
    // exact action with the registered voting key.
    const authorization = await createDelegationAuthorization(
      keypair,
      "create",
      electionId,
      ciphertext
    );

    const { data, error } = await supabase.functions.invoke("delegation-write", {
      body: {
        action: "create",
        electionId,
        sessionToken,
        ciphertext,
        authorization,
      },
    });

    if (error || !data?.success) {
      logger.error("Error creating delegation:", error ?? data);
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
 * Revoke the session holder's active delegation so they can vote directly again.
 */
export async function revokeDelegation(
  electionId: string,
  keypair: StoredKeypair
): Promise<boolean> {
  try {
    const sessionToken = getStoredWorldIdSessionToken();
    if (!sessionToken) {
      logger.error("Cannot revoke delegation without a stored voter session");
      return false;
    }

    const authorization = await createDelegationAuthorization(
      keypair,
      "revoke",
      electionId
    );

    const { data, error } = await supabase.functions.invoke("delegation-write", {
      body: {
        action: "revoke",
        electionId,
        sessionToken,
        authorization,
      },
    });

    if (error || !data?.success) {
      logger.error("Error revoking delegation:", error ?? data);
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
      .from("public_delegations")
      .select("*")
      .eq("election_id", electionId)
      .eq("delegator_pseudonym", delegatorId)
      .eq("status", "active")
      .maybeSingle();

    if (error) {
      logger.error("Error fetching active delegation:", error);
      return null;
    }

    return data ? {
      ...data,
      delegator_id: data.delegator_pseudonym,
    } as StoredDelegation : null;
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
  const delegations: StoredDelegation[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("public_delegations")
      .select("*")
      .eq("election_id", electionId)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) {
      throw new Error("Failed to load active delegations");
    }
    delegations.push(...(data || []).map((delegation) => ({
      ...delegation,
      delegator_id: delegation.delegator_pseudonym,
    }) as StoredDelegation));
    if (!data || data.length < pageSize) break;
  }
  return delegations;
}

// -----------------------------------------------------------------------
// Tally-time operations (authority only)
// -----------------------------------------------------------------------

/**
 * Reconstruct an ElGamalCiphertext from stored delegation coordinates.
 */
function delegationToCiphertext(d: StoredDelegation): ElGamalCiphertext {
  const c1 = new EdwardsPoint(
    parseCanonicalFieldElement(d.delegate_ct_c1_x),
    parseCanonicalFieldElement(d.delegate_ct_c1_y)
  );
  const c2 = new EdwardsPoint(
    parseCanonicalFieldElement(d.delegate_ct_c2_x),
    parseCanonicalFieldElement(d.delegate_ct_c2_y)
  );
  if (
    c1.isIdentity() ||
    c2.isIdentity() ||
    !c1.isOnCurve() ||
    !c1.isInPrimeSubgroup() ||
    !c2.isOnCurve() ||
    !c2.isInPrimeSubgroup()
  ) {
    throw new Error(`Delegation ${d.id} contains an invalid BabyJubJub ciphertext`);
  }
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
  const participants = await getElectionParticipantsForTally(electionId);

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
      throw new Error(
        `Delegation from ${d.delegator_id} could not be decoded safely`
      );
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
