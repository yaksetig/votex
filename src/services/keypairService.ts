
import { StoredKeypair } from "@/types/keypair";
import { verifyKeypairConsistency } from "@/services/elGamalService";
import { logger } from "@/services/logger";
import { KEYPAIR_VERSION } from "@/services/eddsaService";

/**
 * Session-scoped keypair storage.
 *
 * The voter's BabyJubJub private key is kept in sessionStorage so that it
 * survives SPA navigation within a single tab but is automatically cleared
 * when the tab/window closes.  This avoids the long-term exposure risk of
 * localStorage while keeping the UX of derive-once-per-session.
 *
 * On first visit the user must authenticate with their passkey to re-derive
 * the key.  The passkey PRF output is deterministic, so the same key is
 * produced every time.
 */
const KEYPAIR_KEY = "babyJubKeypair";

// Clear any legacy localStorage entry left from previous versions
if (typeof window !== "undefined" && window.localStorage.getItem(KEYPAIR_KEY)) {
  window.localStorage.removeItem(KEYPAIR_KEY);
}

// Check if a keypair exists in session storage
export function getStoredKeypair(): StoredKeypair | null {
  const raw = window.sessionStorage.getItem(KEYPAIR_KEY);
  return raw ? JSON.parse(raw) : null;
}

// Store keypair in session storage (cleared when tab closes)
export function storeKeypair(keypair: StoredKeypair): void {
  window.sessionStorage.setItem(KEYPAIR_KEY, JSON.stringify(keypair));
}

// Clear keypair from session storage
export function clearStoredKeypair(): void {
  window.sessionStorage.removeItem(KEYPAIR_KEY);
}

// Validate stored keypair against current base point and optionally clear if invalid
export function validateAndMigrateKeypair(): { valid: boolean; cleared: boolean; keypair: StoredKeypair | null } {
  const storedKeypair = getStoredKeypair();
  if (!storedKeypair) {
    return { valid: false, cleared: false, keypair: null };
  }

  if (
    storedKeypair.version !== KEYPAIR_VERSION ||
    !storedKeypair.seed ||
    typeof storedKeypair.seed !== "string"
  ) {
    clearStoredKeypair();
    logger.warn("Cleared outdated keypair - unsupported key material format");
    return { valid: false, cleared: true, keypair: null };
  }

  const isConsistent = verifyKeypairConsistency(storedKeypair);
  if (!isConsistent) {
    clearStoredKeypair();
    logger.warn("Cleared outdated keypair - base point mismatch detected");
    return { valid: false, cleared: true, keypair: null };
  }

  return { valid: true, cleared: false, keypair: storedKeypair };
}
