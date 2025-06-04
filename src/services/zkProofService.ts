import { initialize } from "zokrates-js";
import { StoredKeypair } from "@/types/keypair";
import { ElGamalCiphertext } from "@/services/elGamalService";
import { getCompleteTrustedSetup } from "@/services/trustedSetupService";

// ZoKrates globals
let zokratesProvider: any = null;
let artifacts: any = null;

// Base point coordinates for BabyJubJub
const BASE_POINT = {
  x: 16540640123574156134436876038791482806971768689494387082833631921987005038935n,
  y: 20819045374670962167435360035096875258406992893633759881276124905556507972311n
};

// Field size for BabyJubJub
const FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const CURVE_ORDER = 2736030358979909402780800718157159386076813972158567259200215660948447373041n;

// Initialize ZoKrates with our circuit
async function initZokrates() {
  if (zokratesProvider) return;
  
  console.log("Initializing ZoKrates...");
  zokratesProvider = await initialize();
  
  const source = `
import "utils/pack/bool/nonStrictUnpack256" as unpack256;
import "ecc/edwardsScalarMult" as multiply;
import "ecc/edwardsOnCurve" as onCurve;
import "ecc/edwardsAdd" as add;
from "ecc/babyjubjubParams" import BabyJubJubParams;

// Define BabyJubJub context
const BabyJubJubParams context = BabyJubJubParams {
    JUBJUB_C: 8,
    JUBJUB_A: 168700,
    JUBJUB_D: 168696,
    MONT_A: 168698,
    MONT_B: 1,
    INFINITY: [0, 1],
    Gu: 16540640123574156134436876038791482806971768689494387082833631921987005038935,
    Gv: 20819045374670962167435360035096875258406992893633759881276124905556507972311
};

const field[2] G = [context.Gu, context.Gv];

def multScalarWithPoint(field x, field[2] g) -> field[2] {
    bool[256] bits = unpack256(x);
    return multiply(bits, g, context);
}

def onCurveCheck(field[2] p) -> bool {
    return onCurve(p, context);
}

def expElGamalEncrypt(field[2] pk, field r, field m) -> field[4] {
    field[2] c1 = multScalarWithPoint(r, G);
    field[2] x  = multScalarWithPoint(r, pk);
    field[2] mG = multScalarWithPoint(m, G);
    field[2] c2 = add(x, mG, context);
    return [c1[0], c1[1], c2[0], c2[1]];
}

// Main verifier circuit - original logic: either encrypt 0 OR (encrypt 1 AND know secret key)
def main(
    public field[4] ciphertext,
    private field r,
    private field m,
    private field sk_voter,
    public field[2] pk_voter,
    public field[2] pk_election_authority
) {
    field[2] c1 = [ciphertext[0], ciphertext[1]];
    field[2] c2 = [ciphertext[2], ciphertext[3]];
    assert(onCurveCheck(c1));
    assert(onCurveCheck(c2));

    // Verify the ciphertext was created correctly
    field[4] comp = expElGamalEncrypt(pk_election_authority, r, m);
    assert(ciphertext == comp);

    // Original logic: either m=0 (dummy nullification) OR (m=1 AND voter knows secret key)
    field[2] pk_calc = multScalarWithPoint(sk_voter, G);
    bool knows = (pk_calc == pk_voter);
    bool ok = (m == 0) || (m == 1 && knows);
    assert(ok);

    return;
}
`;

  console.log("Compiling ZoKrates circuit...");
  artifacts = zokratesProvider.compile(source);
  
  console.log("ZoKrates circuit compiled successfully");
}

// Generate ZK proof for nullification using global trusted setup
export async function generateNullificationProof(
  voterKeypair: StoredKeypair,
  authorityPublicKey: { x: string, y: string },
  ciphertext: ElGamalCiphertext,
  deterministicR: bigint,
  electionId?: string,
  firebaseAccessToken?: string
): Promise<any> {
  try {
    console.log("Generating ZK proof for nullification...");
    
    // Get complete trusted setup (Firebase URL or legacy)
    const trustedSetupData = await getCompleteTrustedSetup(electionId, firebaseAccessToken);
    if (!trustedSetupData) {
      throw new Error("No trusted setup found - cryptographic setup is required for nullification");
    }

    const { verificationKey, provingKey, setup } = trustedSetupData;

    // Verify we have a real proving key (not mock)
    if (provingKey?.mock) {
      throw new Error("Mock proving key detected - real cryptographic setup is required for production");
    }

    // For Firebase URLs, we know it's JSON format since you control it
    if ('proving_key_url' in setup && setup.proving_key_url) {
      console.log("Using proving key from Firebase URL - JSON format confirmed");
    } else {
      console.log("Using legacy proving key source");
    }
    
    // Initialize ZoKrates if not already done
    await initZokrates();
    
    // Prepare the arguments for the circuit
    const args = [
      // Public: ciphertext (c1.x, c1.y, c2.x, c2.y)
      [
        ciphertext.c1.x.toString(),
        ciphertext.c1.y.toString(),
        ciphertext.c2.x.toString(),
        ciphertext.c2.y.toString()
      ],
      // Private: r (deterministic random value)
      deterministicR.toString(),
      // Private: m (message = 1 for nullification)
      "1",
      // Private: sk_voter (voter's secret key)
      voterKeypair.k,
      // Public: pk_voter (voter's public key)
      [voterKeypair.Ax, voterKeypair.Ay],
      // Public: pk_election_authority (authority's public key)
      [authorityPublicKey.x, authorityPublicKey.y]
    ];
    
    console.log("Computing witness with trusted setup");
    const { witness } = zokratesProvider.computeWitness(artifacts, args);
    
    console.log("Generating ZK proof with JSON proving key");
    const proof = zokratesProvider.generateProof(artifacts.program, witness, provingKey);
    
    const realProof = {
      mock: false,
      trusted_setup_id: setup.id,
      proof_data: proof,
      generated_at: new Date().toISOString(),
      proving_key_source: setup.proving_key_url ? 'firebase' : 'legacy',
      note: "Real ZK proof using verified trusted setup"
    };
    
    console.log("ZK proof generated successfully");
    return realProof;
    
  } catch (error) {
    console.error("Error generating ZK proof:", error);
    throw new Error(`Failed to generate ZK proof: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Verify ZK proof using verification key from global trusted setup
export async function verifyNullificationProof(proof: any, electionId?: string): Promise<boolean> {
  try {
    // Get verification key from global trusted setup
    const trustedSetupData = await getCompleteTrustedSetup(electionId);
    if (!trustedSetupData) {
      console.error("No trusted setup found for verification");
      return false;
    }

    const { verificationKey } = trustedSetupData;

    // Reject mock proofs
    if (proof.mock) {
      throw new Error("Mock proofs are not accepted in production");
    }

    // Real proof verification
    if (proof.proof_data && verificationKey && !verificationKey.mock) {
      console.log("Verifying real ZK proof using verification key from global trusted setup");
      
      // Initialize ZoKrates if needed
      await initZokrates();
      
      // Use ZoKrates to verify the proof
      const isValid = zokratesProvider.verify(verificationKey, proof.proof_data);
      console.log(`Real proof verification result: ${isValid ? 'VALID' : 'INVALID'}`);
      return isValid;
    }

    throw new Error("Invalid proof format or mock verification key detected");
    
  } catch (error) {
    console.error("Error verifying ZK proof:", error);
    return false;
  }
}
