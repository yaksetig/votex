
import { EdwardsPoint } from '@/services/elGamalService';
import { ElGamalCiphertext } from '@/services/elGamalService';
import { getDiscreteLogFromDB, initializeDiscreteLogTable } from '@/services/discreteLogService';

// Generate and initialize discrete log lookup table in Supabase
export async function ensureDiscreteLogTable(maxValue: number = 100): Promise<boolean> {
  return await initializeDiscreteLogTable(maxValue);
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
    r: BigInt(0), // Placeholder since r is lost in homomorphic addition
    ciphertext: [resultC1.x, resultC1.y, resultC2.x, resultC2.y]
  };
}

// Helper function to negate an Edwards point (for subtraction)
function negatePoint(point: EdwardsPoint): EdwardsPoint {
  // In Edwards curves, the negation of point (x, y) is (-x, y)
  return new EdwardsPoint(-point.x, point.y);
}

// Decrypt ElGamal ciphertext that encrypts a value "in the exponent" using Supabase lookup
export async function decryptElGamalInExponent(
  ciphertext: ElGamalCiphertext, 
  privateKey: bigint
): Promise<number | null> {
  // Decrypt: m*G = c2 - sk*c1
  // We implement subtraction as addition of the negated point
  const skTimesC1 = ciphertext.c1.multiply(privateKey);
  const negatedSkTimesC1 = negatePoint(skTimesC1);
  const decryptedPoint = ciphertext.c2.add(negatedSkTimesC1);
  
  // Use Supabase lookup table to find the discrete log
  const pointString = decryptedPoint.toString();
  const result = await getDiscreteLogFromDB(pointString);
  
  if (result === null) {
    console.warn("Could not find discrete log for point:", pointString);
    return null;
  }
  
  return result;
}

// Helper function to convert stored ciphertext back to ElGamalCiphertext
export function reconstructElGamalCiphertext(storedCiphertext: any): ElGamalCiphertext {
  const c1 = new EdwardsPoint(
    BigInt(storedCiphertext.c1.x),
    BigInt(storedCiphertext.c1.y)
  );
  const c2 = new EdwardsPoint(
    BigInt(storedCiphertext.c2.x),
    BigInt(storedCiphertext.c2.y)
  );
  
  return {
    c1,
    c2,
    r: BigInt(0), // Placeholder since r is not stored
    ciphertext: [c1.x, c1.y, c2.x, c2.y]
  };
}
