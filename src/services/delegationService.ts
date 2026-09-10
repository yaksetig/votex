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
} from "@/services/elGamalService";
import { getElectionParticipantsForTally } from "@/services/electionParticipantsService";
import { getStoredWorldIdSessionToken } from "@/services/worldIdSessionService";
import { logger } from "@/services/logger";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { buildDelegationMessage, type CiphertextStrings } from "@protocol";
import {
  decodeDelegations,
  type DecodedDelegations,
  type StoredDelegation,
} from "@/services/delegationDecoding";

export type {
  DecodedDelegations,
  DelegationResolution,
  InvalidDelegation,
  StoredDelegation,
} from "@/services/delegationDecoding";
export { decodeDelegations } from "@/services/delegationDecoding";
import { signMessageWithStoredSeed } from "@/services/eddsaService";
import type { StoredKeypair } from "@/types/keypair";

// -----------------------------------------------------------------------
// Write operations
// -----------------------------------------------------------------------

export type DelegationCiphertextStrings = CiphertextStrings;

export interface DelegationAuthorization {
  issuedAt: number;
  signature: string;
}

export { buildDelegationMessage };

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
  const rows = await fetchAllRows((from, to) =>
    supabase
      .from("public_delegations")
      .select("*")
      .eq("election_id", electionId)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .range(from, to)
  ).catch(() => {
    throw new Error("Failed to load active delegations");
  });
  return rows.map((delegation) => ({
    ...delegation,
    delegator_id: delegation.delegator_pseudonym,
  }) as StoredDelegation);
}

// -----------------------------------------------------------------------
// Tally-time operations (authority only)
// -----------------------------------------------------------------------

/**
 * Decrypt all delegations for an election and resolve delegate identities.
 *
 * Returns a list of resolved delegations and a weight map:
 *   delegateParticipantId → total voting weight (1 + delegators count)
 */
export async function resolveDelegations(
  electionId: string,
  authorityPrivateKey: bigint
): Promise<DecodedDelegations> {
  const delegations = await getElectionDelegations(electionId);
  const participants = await getElectionParticipantsForTally(electionId);

  // Sort participants by joined_at for stable index mapping
  const sorted = [...participants].sort(
    (a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
  );

  return decodeDelegations(delegations, sorted, authorityPrivateKey);
}
