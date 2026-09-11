/**
 * Unbiased Fisher-Yates shuffle driven by the Web Crypto CSPRNG.
 *
 * Indices are drawn by rejection sampling (a 32-bit draw is discarded when it
 * falls into the incomplete final bucket), so no position is favoured. Used
 * to place the submitter's own slot at a random position in a k-anonymity
 * batch; a biased shuffle would leak that position.
 */
export function secureShuffle<T>(items: readonly T[]): T[] {
  const shuffled = [...items];
  const buffer = new Uint32Array(1);
  for (let i = shuffled.length - 1; i > 0; i--) {
    const range = i + 1;
    const limit = Math.floor(0x100000000 / range) * range;
    let candidate: number;
    do {
      crypto.getRandomValues(buffer);
      candidate = buffer[0];
    } while (candidate >= limit);
    const j = candidate % range;
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
