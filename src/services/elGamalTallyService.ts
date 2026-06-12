
import { EdwardsPoint, negatePoint } from '@/services/elGamalService';
import { ElGamalCiphertext } from '@/services/elGamalService';
import { logger } from '@/services/logger';

// Discrete logs are computed locally (n*G for n = 0..max) and memoized for
// the session. The old Supabase lookup table allowed open inserts, so its
// contents could not be trusted for tally decoding (now locked down in
// migration 20260611100300); local computation removes the dependency
// entirely. Values are tiny (0/1 for nullification bits, participant indices
// for delegations), so the incremental walk costs milliseconds.
const discreteLogMemo = new Map<string, number>();
let memoizedUpTo = -1;

function extendDiscreteLogMemo(maxValue: number): void {
  if (memoizedUpTo >= maxValue) {
    return;
  }

  const G = EdwardsPoint.base();
  let current =
    memoizedUpTo < 0
      ? EdwardsPoint.identity()
      : G.multiply(BigInt(memoizedUpTo));

  for (let n = Math.max(memoizedUpTo, 0); n <= maxValue; n++) {
    if (n > memoizedUpTo) {
      discreteLogMemo.set(current.toString(), n);
    }
    current = current.add(G);
  }

  memoizedUpTo = maxValue;
}

// Ensure the local lookup covers 0..maxValue. Kept async and boolean-returning
// for call-site compatibility with the old Supabase-backed initializer.
export async function ensureDiscreteLogTable(maxValue: number = 100): Promise<boolean> {
  try {
    extendDiscreteLogMemo(maxValue);
    return true;
  } catch (error) {
    logger.error('Error preparing discrete log lookup:', error);
    return false;
  }
}

// Decrypt ElGamal ciphertext that encrypts a value "in the exponent".
export async function decryptElGamalInExponent(
  ciphertext: ElGamalCiphertext,
  privateKey: bigint
): Promise<number | null> {
  // Decrypt: m*G = c2 - sk*c1
  // We implement subtraction as addition of the negated point
  const skTimesC1 = ciphertext.c1.multiply(privateKey);
  const negatedSkTimesC1 = negatePoint(skTimesC1);
  const decryptedPoint = ciphertext.c2.add(negatedSkTimesC1);

  const pointString = decryptedPoint.toString();
  const result = discreteLogMemo.get(pointString);

  if (result === undefined) {
    logger.warn("Could not find discrete log for point:", pointString);
    return null;
  }

  return result;
}
