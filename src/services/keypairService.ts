
import { supabase } from "@/integrations/supabase/client";
import { StoredKeypair } from "@/types/keypair";
import { verifyKeypairConsistency } from "@/services/elGamalService";
import { logger } from "@/services/logger";

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
if (typeof window !== "undefined" && localStorage.getItem(KEYPAIR_KEY)) {
  localStorage.removeItem(KEYPAIR_KEY);
}

// Check if a keypair exists in session storage
export function getStoredKeypair(): StoredKeypair | null {
  const raw = sessionStorage.getItem(KEYPAIR_KEY);
  return raw ? JSON.parse(raw) : null;
}

// Store keypair in session storage (cleared when tab closes)
export function storeKeypair(keypair: StoredKeypair): void {
  sessionStorage.setItem(KEYPAIR_KEY, JSON.stringify(keypair));
}

// Clear keypair from session storage
export function clearStoredKeypair(): void {
  sessionStorage.removeItem(KEYPAIR_KEY);
}

// Validate stored keypair against current base point and optionally clear if invalid
export function validateAndMigrateKeypair(): { valid: boolean; cleared: boolean; keypair: StoredKeypair | null } {
  const storedKeypair = getStoredKeypair();
  if (!storedKeypair) {
    return { valid: false, cleared: false, keypair: null };
  }

  const isConsistent = verifyKeypairConsistency(storedKeypair);
  if (!isConsistent) {
    clearStoredKeypair();
    logger.warn("Cleared outdated keypair - base point mismatch detected");
    return { valid: false, cleared: true, keypair: null };
  }

  return { valid: true, cleared: false, keypair: storedKeypair };
}

// Register a keypair in the database
export async function registerKeypair(keypair: StoredKeypair): Promise<boolean> {
  try {
    // Check if keypair is already registered
    const { data: existingKeypair } = await supabase
      .from("keypairs")
      .select("*")
      .eq("public_key_x", keypair.Ax)
      .eq("public_key_y", keypair.Ay)
      .single();

    if (existingKeypair) {
      logger.debug("Keypair already registered");
      return true;
    }

    // Register new keypair
    const { error } = await supabase
      .from("keypairs")
      .insert({
        public_key_x: keypair.Ax,
        public_key_y: keypair.Ay
      });

    if (error) {
      logger.error("Error registering keypair:", error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error("Error in keypair registration:", error);
    return false;
  }
}
