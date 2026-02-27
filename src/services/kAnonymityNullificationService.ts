// k-Anonymity Nullification Service (XOR Accumulator)
//
// Generates k nullifications per submission. For the voter's own slot the
// nullification bit is either 0 (dummy) or 1 (actual). For all other
// slots the bit is always 0 (dummy). Each nullification computes:
//
//   1. Fresh encryption [[x]]  = (rG, xG + rH)
//   2. Conditional gate [[x'y]] = (sG + x'·acc_c1, sH + x'·acc_c2)
//   3. New accumulator  = [[x]] - [[x'y]]  (done server-side)
//
// A ZK proof attests to correctness of steps 1-2 without revealing x.

import { StoredKeypair } from "@/types/keypair";
import { Groth16Proof } from "@/types/proof";
import {
  getElectionParticipants,
  ElectionParticipant,
} from "@/services/electionParticipantsService";
import {
  elgamalEncrypt,
  computeXorGate,
  computeXorAccumulator,
  EdwardsPoint,
  ElGamalCiphertext,
} from "@/services/elGamalService";
import { randomScalar } from "@/services/crypto/utils";
import { CURVE_ORDER } from "@/services/crypto/constants";
import {
  getOrCreateAccumulator,
} from "@/services/accumulatorService";
import {
  generateProofsInParallel,
  ProofInput,
} from "@/services/parallelZkProofService";
import { logger } from "@/services/logger";

const DEFAULT_K = 6;

export interface NullificationBatchItem {
  targetUserId: string;
  isReal: boolean;
  ciphertext: ElGamalCiphertext;
  gateOutput: ElGamalCiphertext;
  newAccumulator: ElGamalCiphertext;
  accumulatorVersion: number;
  zkp: { proof: Groth16Proof; publicSignals: string[] } | null;
}

export interface KAnonymityProgress {
  step: "preparing" | "encrypting" | "proving" | "complete";
  completed: number;
  total: number;
  message: string;
}

// Cryptographically secure random selection of participants
function selectRandomParticipants(
  participants: ElectionParticipant[],
  count: number,
  excludeId: string
): ElectionParticipant[] {
  const otherParticipants = participants.filter(
    (p) => p.participant_id !== excludeId
  );

  if (otherParticipants.length <= count) {
    return otherParticipants;
  }

  const shuffled = [...otherParticipants];
  const randomValues = new Uint32Array(shuffled.length);
  crypto.getRandomValues(randomValues);

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = randomValues[i] % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, count);
}

// Generate k-anonymous nullifications using XOR accumulators
export async function generateKAnonymousNullifications(
  electionId: string,
  voterUserId: string,
  voterKeypair: StoredKeypair,
  authorityPublicKey: { x: string; y: string },
  isActualNullification: boolean,
  k: number = DEFAULT_K,
  onProgress?: (progress: KAnonymityProgress) => void
): Promise<NullificationBatchItem[]> {
  logger.debug(
    `Generating k-anonymous XOR nullifications with k=${k}, actual=${isActualNullification}`
  );

  // Step 1: Fetch all participants
  onProgress?.({
    step: "preparing",
    completed: 0,
    total: k,
    message: "Fetching election participants...",
  });

  const participants = await getElectionParticipants(electionId);
  const participantCount = participants.length;
  const numNullifications = Math.min(k, participantCount);

  logger.debug(
    `Election has ${participantCount} participants, generating ${numNullifications} nullifications`
  );

  // Step 2: Select participant slots
  const ownParticipant = participants.find(
    (p) => p.participant_id === voterUserId
  );
  if (!ownParticipant) {
    throw new Error("Voter is not a participant in this election");
  }

  const otherSlots = selectRandomParticipants(
    participants,
    numNullifications - 1,
    voterUserId
  );

  const slotsToNullify: {
    participant: ElectionParticipant;
    isReal: boolean;
  }[] = [
    { participant: ownParticipant, isReal: isActualNullification },
    ...otherSlots.map((p) => ({ participant: p, isReal: false })),
  ];

  // Step 3: For each slot, fetch accumulator, compute gate, build proof input
  onProgress?.({
    step: "encrypting",
    completed: 0,
    total: numNullifications,
    message: "Computing XOR gate outputs...",
  });

  const authorityPoint = new EdwardsPoint(
    BigInt(authorityPublicKey.x),
    BigInt(authorityPublicKey.y)
  );

  const nullificationItems: NullificationBatchItem[] = [];
  const proofInputs: ProofInput[] = [];

  for (let i = 0; i < slotsToNullify.length; i++) {
    const { participant, isReal } = slotsToNullify[i];
    const x = isReal ? 1 : 0;

    // Fetch the current accumulator for this voter slot
    const { accumulator, version } = await getOrCreateAccumulator(
      electionId,
      participant.participant_id
    );

    // Generate random values for this nullification
    const r = randomScalar(CURVE_ORDER);
    const s = randomScalar(CURVE_ORDER);

    // Fresh encryption [[x]] = (rG, xG + rH)
    const freshCiphertext = elgamalEncrypt(authorityPoint, x, r);

    // Conditional gate [[x'y]] = (sG + x'·acc_c1, sH + x'·acc_c2)
    const gateOutput = computeXorGate(x, accumulator, authorityPoint, s);

    // New accumulator = [[x]] - [[x'y]]
    const newAccumulator = computeXorAccumulator(freshCiphertext, gateOutput);

    nullificationItems.push({
      targetUserId: participant.participant_id,
      isReal,
      ciphertext: freshCiphertext,
      gateOutput,
      newAccumulator,
      accumulatorVersion: version,
      zkp: null,
    });

    // Build proof input for the XOR circuit
    proofInputs.push({
      id: participant.participant_id,
      input: {
        ciphertext: [
          freshCiphertext.c1.x.toString(),
          freshCiphertext.c1.y.toString(),
          freshCiphertext.c2.x.toString(),
          freshCiphertext.c2.y.toString(),
        ],
        gate_output: [
          gateOutput.c1.x.toString(),
          gateOutput.c1.y.toString(),
          gateOutput.c2.x.toString(),
          gateOutput.c2.y.toString(),
        ],
        accumulator: [
          accumulator.c1.x.toString(),
          accumulator.c1.y.toString(),
          accumulator.c2.x.toString(),
          accumulator.c2.y.toString(),
        ],
        pk_voter: [voterKeypair.Ax, voterKeypair.Ay],
        pk_authority: [authorityPublicKey.x, authorityPublicKey.y],
        x: x.toString(),
        r: r.toString(),
        s: s.toString(),
        sk_voter: voterKeypair.k,
      },
    });

    onProgress?.({
      step: "encrypting",
      completed: i + 1,
      total: numNullifications,
      message: `Computed ${i + 1} of ${numNullifications} gate outputs...`,
    });
  }

  // Step 4: Generate ZK proofs in parallel
  onProgress?.({
    step: "proving",
    completed: 0,
    total: numNullifications,
    message: `Generating ${numNullifications} zero-knowledge proofs in parallel...`,
  });

  const proofResults = await generateProofsInParallel(
    proofInputs,
    (completed, total) => {
      onProgress?.({
        step: "proving",
        completed,
        total,
        message: `Generated ${completed} of ${total} proofs...`,
      });
    }
  );

  // Step 5: Attach proofs to items
  for (const result of proofResults) {
    const item = nullificationItems.find(
      (n) => n.targetUserId === result.id
    );
    if (item && result.success) {
      item.zkp = {
        proof: result.proof!,
        publicSignals: result.publicSignals!,
      };
    } else if (!result.success) {
      logger.error(
        `Failed to generate proof for slot ${result.id}:`,
        result.error
      );
      throw new Error(`Failed to generate proof: ${result.error}`);
    }
  }

  onProgress?.({
    step: "complete",
    completed: numNullifications,
    total: numNullifications,
    message: "All proofs generated successfully!",
  });

  logger.debug(
    `Successfully generated ${nullificationItems.length} k-anonymous XOR nullifications`
  );

  return nullificationItems;
}

export function getKAnonymityParameter(): number {
  return DEFAULT_K;
}
