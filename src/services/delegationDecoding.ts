/**
 * Delegation decoding (pure, no Supabase dependency) so the tally-time logic
 * can be unit-tested without a browser client.
 */

import { EdwardsPoint, ElGamalCiphertext } from "@/services/elGamalService";
import { decryptElGamalInExponent } from "@/services/elGamalTallyService";
import { parseCanonicalFieldElement } from "@/services/crypto/utils";

export interface StoredDelegation {
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

export interface DelegationResolution {
  delegatorId: string;
  delegateIndex: number;
  delegateParticipantId: string;
}

export interface InvalidDelegation {
  delegationId: string;
  delegatorId: string;
  reason: string;
}

export interface DecodedDelegations {
  resolved: DelegationResolution[];
  weightMap: Map<string, number>;
  delegatorIds: Set<string>;
  invalidDelegations: InvalidDelegation[];
}

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
 * Decode a set of delegations against the canonical participant order.
 *
 * The authority key is verified against the registered authority key before
 * this runs (tallyService), so a delegation that does not decrypt to an index
 * in [0, participants) can only be malformed or malicious input from the
 * delegator. Aborting the whole tally would let any single participant block
 * the election; instead such delegations are reported as invalid and treated
 * as if they did not exist (the delegator keeps their own direct ballot).
 */
export async function decodeDelegations(
  delegations: StoredDelegation[],
  sortedParticipants: Array<{ participant_id: string }>,
  authorityPrivateKey: bigint
): Promise<DecodedDelegations> {
  const resolved: DelegationResolution[] = [];
  const weightMap = new Map<string, number>();
  const delegatorIds = new Set<string>();
  const invalidDelegations: InvalidDelegation[] = [];

  for (const d of delegations) {
    let index: number | null = null;
    try {
      const ct = delegationToCiphertext(d);
      index = await decryptElGamalInExponent(ct, authorityPrivateKey);
    } catch (error) {
      invalidDelegations.push({
        delegationId: d.id,
        delegatorId: d.delegator_id,
        reason: error instanceof Error ? error.message : "invalid ciphertext",
      });
      continue;
    }

    if (index === null || index < 0 || index >= sortedParticipants.length) {
      invalidDelegations.push({
        delegationId: d.id,
        delegatorId: d.delegator_id,
        reason: "delegate index is outside the participant list",
      });
      continue;
    }

    const delegate = sortedParticipants[index];
    if (delegate.participant_id === d.delegator_id) {
      invalidDelegations.push({
        delegationId: d.id,
        delegatorId: d.delegator_id,
        reason: "self-delegation",
      });
      continue;
    }

    resolved.push({
      delegatorId: d.delegator_id,
      delegateIndex: index,
      delegateParticipantId: delegate.participant_id,
    });

    delegatorIds.add(d.delegator_id);
    const current = weightMap.get(delegate.participant_id) ?? 1;
    weightMap.set(delegate.participant_id, current + 1);
  }

  return { resolved, weightMap, delegatorIds, invalidDelegations };
}
