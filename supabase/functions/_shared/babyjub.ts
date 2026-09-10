// Canonical BabyJubJub point validation for edge-function inputs. The curve
// arithmetic itself lives in ./protocol.ts.

import {
  BABYJUB_FIELD,
  BABYJUB_SUBGROUP_ORDER,
  isIdentityPoint,
  isInPrimeSubgroup,
  parseCanonicalFieldElement,
} from "./protocol.ts";

export { BABYJUB_FIELD, BABYJUB_SUBGROUP_ORDER };

interface PointInput {
  x: string;
  y: string;
}

/**
 * True only when both coordinates are canonical decimals in [0, p), the point
 * is on the curve and in the prime-order subgroup, and (unless allowed) is
 * not the identity. Never throws on malformed input.
 */
export function isCanonicalPrimeSubgroupPoint(
  input: PointInput,
  allowIdentity = true
): boolean {
  try {
    const x = parseCanonicalFieldElement(input.x);
    const y = parseCanonicalFieldElement(input.y);
    if (x === null || y === null) return false;

    const point = { x, y };
    if (!allowIdentity && isIdentityPoint(point)) return false;
    return isInPrimeSubgroup(point);
  } catch {
    return false;
  }
}
