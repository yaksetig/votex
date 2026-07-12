import {
  isPlaceholderAuthorityKey,
  isUuid,
  PLACEHOLDER_AUTHORITY_PUBLIC_KEY,
} from "./fixedAuthority.ts";

Deno.test("fixed authority requires a real UUID", () => {
  if (!isUuid("f78d4e1b-c82d-4ef7-93ef-0348eca57ee5")) throw new Error("valid UUID rejected");
  if (isUuid("Default Election Authority")) throw new Error("invalid UUID accepted");
});

Deno.test("historical base-point authority key is recognized as a placeholder", () => {
  if (!isPlaceholderAuthorityKey(PLACEHOLDER_AUTHORITY_PUBLIC_KEY)) {
    throw new Error("placeholder key was not rejected");
  }
  if (isPlaceholderAuthorityKey({ x: "1", y: "2" })) {
    throw new Error("real key candidate was rejected as placeholder");
  }
});
