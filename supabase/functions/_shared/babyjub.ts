export const BABYJUB_FIELD =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;
export const BABYJUB_SUBGROUP_ORDER =
  2736030358979909402780800718157159386076813972158567259200215660948447373041n;

const A = 168700n;
const D = 168696n;
const MAX_COORDINATE_DIGITS = BABYJUB_FIELD.toString().length;

interface PointInput {
  x: string;
  y: string;
}

interface Point {
  x: bigint;
  y: bigint;
}

function mod(value: bigint): bigint {
  const result = value % BABYJUB_FIELD;
  return result >= 0n ? result : result + BABYJUB_FIELD;
}

function inverse(value: bigint): bigint | null {
  let oldR = mod(value);
  let r = BABYJUB_FIELD;
  let oldS = 1n;
  let s = 0n;

  while (r !== 0n) {
    const quotient = oldR / r;
    [oldR, r] = [r, oldR - quotient * r];
    [oldS, s] = [s, oldS - quotient * s];
  }

  return oldR === 1n ? mod(oldS) : null;
}

function add(left: Point, right: Point): Point {
  const x1x2 = mod(left.x * right.x);
  const y1y2 = mod(left.y * right.y);
  const product = mod(D * x1x2 * y1y2);
  const xDenominator = inverse(1n + product);
  const yDenominator = inverse(1n - product);
  if (xDenominator === null || yDenominator === null) {
    throw new Error("Invalid BabyJubJub addition denominator");
  }

  return {
    x: mod((left.x * right.y + left.y * right.x) * xDenominator),
    y: mod((y1y2 - A * x1x2) * yDenominator),
  };
}

function multiply(point: Point, scalar: bigint): Point {
  let result: Point = { x: 0n, y: 1n };
  let addend = point;
  let remaining = scalar;
  while (remaining > 0n) {
    if ((remaining & 1n) === 1n) {
      result = add(result, addend);
    }
    addend = add(addend, addend);
    remaining >>= 1n;
  }
  return result;
}

function parseCoordinate(value: string): bigint | null {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_COORDINATE_DIGITS ||
    !/^(0|[1-9][0-9]*)$/.test(value)
  ) {
    return null;
  }

  const coordinate = BigInt(value);
  return coordinate < BABYJUB_FIELD ? coordinate : null;
}

function isOnCurve(point: Point): boolean {
  const xSquared = mod(point.x * point.x);
  const ySquared = mod(point.y * point.y);
  return mod(A * xSquared + ySquared) === mod(1n + D * xSquared * ySquared);
}

function isIdentity(point: Point): boolean {
  return point.x === 0n && point.y === 1n;
}

export function isCanonicalPrimeSubgroupPoint(
  input: PointInput,
  allowIdentity = true
): boolean {
  try {
    const x = parseCoordinate(input.x);
    const y = parseCoordinate(input.y);
    if (x === null || y === null) return false;

    const point = { x, y };
    if (!allowIdentity && isIdentity(point)) return false;
    if (!isOnCurve(point)) return false;
    return isIdentity(multiply(point, BABYJUB_SUBGROUP_ORDER));
  } catch {
    return false;
  }
}
