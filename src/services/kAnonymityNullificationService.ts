// k-Anonymity Nullification Service
// Generates multiple nullifications to ensure privacy against coercion

import { StoredKeypair } from "@/types/keypair";
import { getElectionParticipants, ElectionParticipant } from "@/services/electionParticipantsService";
import { 
  elgamalEncrypt, 
  generateDeterministicR, 
  EdwardsPoint,
  ElGamalCiphertext 
} from "@/services/elGamalService";
import { generateProofsInParallel, ProofInput, ProofResult } from "@/services/parallelZkProofService";

// Default k-anonymity parameter
const DEFAULT_K = 6;

export interface NullificationBatchItem {
  targetUserId: string;
  isReal: boolean; // true = m=1 (actual), false = m=0 (dummy)
  ciphertext: ElGamalCiphertext;
  zkp: { proof: any; publicSignals: string[] } | null;
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
  // Filter out the current user
  const otherParticipants = participants.filter(p => p.participant_id !== excludeId);
  
  if (otherParticipants.length <= count) {
    return otherParticipants;
  }

  // Fisher-Yates shuffle with crypto.getRandomValues
  const shuffled = [...otherParticipants];
  const randomValues = new Uint32Array(shuffled.length);
  crypto.getRandomValues(randomValues);

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = randomValues[i] % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, count);
}

// Generate k-anonymous nullifications
export async function generateKAnonymousNullifications(
  electionId: string,
  voterUserId: string,
  voterKeypair: StoredKeypair,
  authorityPublicKey: { x: string; y: string },
  isActualNullification: boolean,
  k: number = DEFAULT_K,
  onProgress?: (progress: KAnonymityProgress) => void
): Promise<NullificationBatchItem[]> {
  console.log(`Generating k-anonymous nullifications with k=${k}, actual=${isActualNullification}`);

  // Step 1: Fetch all participants
  onProgress?.({
    step: "preparing",
    completed: 0,
    total: k,
    message: "Fetching election participants..."
  });

  const participants = await getElectionParticipants(electionId);
  const participantCount = participants.length;

  console.log(`Election has ${participantCount} participants`);

  // Calculate how many nullifications to generate
  const numNullifications = Math.min(k, participantCount);

  onProgress?.({
    step: "preparing",
    completed: 0,
    total: numNullifications,
    message: `Preparing ${numNullifications} privacy-preserving nullifications...`
  });

  // Step 2: Select which participant slots to use
  // Always include the voter's own slot
  const ownParticipant = participants.find(p => p.participant_id === voterUserId);
  if (!ownParticipant) {
    throw new Error("Voter is not a participant in this election");
  }

  // Select random other participants
  const otherSlots = selectRandomParticipants(
    participants,
    numNullifications - 1,
    voterUserId
  );

  // Build the list of slots to nullify
  const slotsToNullify: { participant: ElectionParticipant; isReal: boolean }[] = [
    { 
      participant: ownParticipant, 
      isReal: isActualNullification // Real nullification if actual, dummy if dummy
    },
    ...otherSlots.map(p => ({ 
      participant: p, 
      isReal: false // All other slots are always dummy (m=0)
    }))
  ];

  console.log(`Slots to nullify: ${slotsToNullify.length} (1 ${isActualNullification ? 'real' : 'dummy'} + ${otherSlots.length} dummy)`);

  // Step 3: Generate ElGamal ciphertexts for each slot
  onProgress?.({
    step: "encrypting",
    completed: 0,
    total: numNullifications,
    message: "Generating encrypted nullifications..."
  });

  const authorityPoint = new EdwardsPoint(
    BigInt(authorityPublicKey.x),
    BigInt(authorityPublicKey.y)
  );

  const nullificationItems: NullificationBatchItem[] = [];
  const proofInputs: ProofInput[] = [];

  for (let i = 0; i < slotsToNullify.length; i++) {
    const { participant, isReal } = slotsToNullify[i];
    const message = isReal ? 1 : 0;

    // Generate deterministic r for this slot
    const userPrivateKey = BigInt(voterKeypair.k);
    const userPublicKey = { x: BigInt(voterKeypair.Ax), y: BigInt(voterKeypair.Ay) };
    const deterministicR = await generateDeterministicR(userPrivateKey, userPublicKey);

    // Generate ElGamal ciphertext
    const ciphertext = elgamalEncrypt(authorityPoint, message, deterministicR);

    nullificationItems.push({
      targetUserId: participant.participant_id,
      isReal,
      ciphertext,
      zkp: null
    });

    // Prepare proof input
    proofInputs.push({
      id: participant.participant_id,
      input: {
        ciphertext: [
          ciphertext.c1.x.toString(),
          ciphertext.c1.y.toString(),
          ciphertext.c2.x.toString(),
          ciphertext.c2.y.toString()
        ],
        pk_voter: [voterKeypair.Ax, voterKeypair.Ay],
        pk_authority: [authorityPublicKey.x, authorityPublicKey.y],
        r: deterministicR.toString(),
        m: message.toString(),
        sk_voter: voterKeypair.k
      }
    });

    onProgress?.({
      step: "encrypting",
      completed: i + 1,
      total: numNullifications,
      message: `Encrypted ${i + 1} of ${numNullifications}...`
    });
  }

  // Step 4: Generate ZK proofs in parallel
  onProgress?.({
    step: "proving",
    completed: 0,
    total: numNullifications,
    message: `Generating ${numNullifications} zero-knowledge proofs in parallel...`
  });

  const proofResults = await generateProofsInParallel(proofInputs, (completed, total) => {
    onProgress?.({
      step: "proving",
      completed,
      total,
      message: `Generated ${completed} of ${total} proofs...`
    });
  });

  // Step 5: Attach proofs to nullification items
  for (const result of proofResults) {
    const item = nullificationItems.find(n => n.targetUserId === result.id);
    if (item && result.success) {
      item.zkp = {
        proof: result.proof!,
        publicSignals: result.publicSignals!
      };
    } else if (!result.success) {
      console.error(`Failed to generate proof for slot ${result.id}:`, result.error);
      throw new Error(`Failed to generate proof: ${result.error}`);
    }
  }

  onProgress?.({
    step: "complete",
    completed: numNullifications,
    total: numNullifications,
    message: "All proofs generated successfully!"
  });

  console.log(`Successfully generated ${nullificationItems.length} k-anonymous nullifications`);

  return nullificationItems;
}

// Get the k-anonymity parameter (could be made configurable per election)
export function getKAnonymityParameter(): number {
  return DEFAULT_K;
}
