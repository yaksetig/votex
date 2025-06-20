
import { initialize } from "zokrates-js";
import { StoredKeypair } from "@/types/keypair";
import { ElGamalCiphertext } from "@/services/elGamalService";

// ZoKrates globals
let zokratesProvider: any = null;
let artifacts: any = null;
let keypair: any = null;

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
  
  console.log("Setting up ZoKrates keypair...");
  keypair = zokratesProvider.setup(artifacts.program);
  
  console.log("ZoKrates initialization complete");
}

// Generate ZK proof for nullification
export async function generateNullificationProof(
  voterKeypair: StoredKeypair,
  authorityPublicKey: { x: string, y: string },
  ciphertext: ElGamalCiphertext,
  deterministicR: bigint,
  message: number = 1  // Add message parameter - 1 for actual nullification, 0 for dummy
): Promise<any> {
  try {
    console.log(`Generating ZK proof for ${message === 1 ? 'actual' : 'dummy'} nullification...`);
    
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
      // Private: m (message = 1 for actual nullification, 0 for dummy)
      message.toString(),
      // Private: sk_voter (voter's secret key)
      voterKeypair.k,
      // Public: pk_voter (voter's public key - this proves they know the secret key)
      [voterKeypair.Ax, voterKeypair.Ay],
      // Public: pk_election_authority (authority's public key)
      [authorityPublicKey.x, authorityPublicKey.y]
    ];
    
    console.log("Computing witness with args:", {
      ciphertext: args[0],
      r: args[1],
      m: args[2],
      sk_voter: "***hidden***",
      pk_voter: args[4],
      pk_authority: args[5]
    });
    
    const { witness } = zokratesProvider.computeWitness(artifacts, args);
    
    console.log("Generating proof...");
    const proof = zokratesProvider.generateProof(artifacts.program, witness, keypair.pk);
    
    console.log(`ZK proof generated successfully for ${message === 1 ? 'actual' : 'dummy'} nullification:`, proof);
    return proof;
    
  } catch (error) {
    console.error("Error generating ZK proof:", error);
    throw new Error(`Failed to generate ZK proof: ${error}`);
  }
}

// Verify ZK proof (optional - for testing/debugging)
export async function verifyNullificationProof(proof: any): Promise<boolean> {
  try {
    await initZokrates();
    const valid = zokratesProvider.verify(keypair.vk, proof);
    console.log("ZK proof verification result:", valid);
    return valid;
  } catch (error) {
    console.error("Error verifying ZK proof:", error);
    return false;
  }
}
