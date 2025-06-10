
import { EdwardsPoint } from '@/services/babyJubjubService';
import { ElGamalCiphertext } from '@/services/elGamalService';

// Generate a lookup table for discrete log solving
export function generateDiscreteLogTable(maxValue: number = 100): Map<string, number> {
  const table = new Map<string, number>();
  
  // G is the base point
  const G = EdwardsPoint.fromAffine(BigInt(1), BigInt(0));
  let current = EdwardsPoint.fromAffine(BigInt(0), BigInt(1)); // Identity element (0*G)
  
  for (let n = 0; n <= maxValue; n++) {
    table.set(current.toString(), n);
    if (n < maxValue) {
      current = current.add(G);
    }
  }
  
  return table;
}

// Add multiple ElGamal ciphertexts homomorphically
export function addElGamalCiphertexts(ciphertexts: ElGamalCiphertext[]): ElGamalCiphertext {
  if (ciphertexts.length === 0) {
    throw new Error("Cannot add empty array of ciphertexts");
  }
  
  if (ciphertexts.length === 1) {
    return ciphertexts[0];
  }
  
  // Start with the first ciphertext
  let resultC1 = ciphertexts[0].c1;
  let resultC2 = ciphertexts[0].c2;
  
  // Add all other ciphertexts
  for (let i = 1; i < ciphertexts.length; i++) {
    resultC1 = resultC1.add(ciphertexts[i].c1);
    resultC2 = resultC2.add(ciphertexts[i].c2);
  }
  
  return {
    c1: resultC1,
    c2: resultC2,
    ciphertext: [resultC1, resultC2] // For compatibility
  };
}

// Decrypt ElGamal ciphertext that encrypts a value "in the exponent"
export function decryptElGamalInExponent(
  ciphertext: ElGamalCiphertext, 
  privateKey: bigint,
  lookupTable: Map<string, number>
): number | null {
  // Decrypt: m*G = c2 - sk*c1
  const skTimesC1 = ciphertext.c1.scalarMult(privateKey);
  const decryptedPoint = ciphertext.c2.subtract(skTimesC1);
  
  // Use lookup table to find the discrete log
  const pointString = decryptedPoint.toString();
  const result = lookupTable.get(pointString);
  
  if (result === undefined) {
    console.warn("Could not find discrete log for point:", pointString);
    return null;
  }
  
  return result;
}

// Helper function to convert stored ciphertext back to ElGamalCiphertext
export function reconstructElGamalCiphertext(storedCiphertext: any): ElGamalCiphertext {
  const c1 = EdwardsPoint.fromAffine(
    BigInt(storedCiphertext.c1.x),
    BigInt(storedCiphertext.c1.y)
  );
  const c2 = EdwardsPoint.fromAffine(
    BigInt(storedCiphertext.c2.x),
    BigInt(storedCiphertext.c2.y)
  );
  
  return {
    c1,
    c2,
    ciphertext: [c1, c2]
  };
}
