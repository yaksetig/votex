
import { EdwardsPoint } from '@/services/elGamalService';
import { ElGamalCiphertext } from '@/services/elGamalService';
import { getDiscreteLogFromDB, initializeDiscreteLogTable } from '@/services/discreteLogService';
import { logger } from '@/services/logger';

// Generate and initialize discrete log lookup table in Supabase
export async function ensureDiscreteLogTable(maxValue: number = 100): Promise<boolean> {
  return await initializeDiscreteLogTable(maxValue);
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
    logger.warn("Could not find discrete log for point:", pointString);
    return null;
  }
  
  return result;
}
