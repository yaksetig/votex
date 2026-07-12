export const PLACEHOLDER_AUTHORITY_PUBLIC_KEY = {
  x: "5299619240641551281634865583518297030282874472190772894086521144482721001553",
  y: "16950150798460657717958625567821834550301663161624707787222815936182638968203",
} as const;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function isPlaceholderAuthorityKey(key: { x: string; y: string }): boolean {
  return key.x === PLACEHOLDER_AUTHORITY_PUBLIC_KEY.x &&
    key.y === PLACEHOLDER_AUTHORITY_PUBLIC_KEY.y;
}
