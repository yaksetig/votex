/**
 * @vitest-environment jsdom
 */

/**
 * VTX-013 / VTX-010: Keypair session-storage boundary tests.
 * Requires a DOM environment (jsdom) for localStorage/sessionStorage.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { KEYPAIR_VERSION } from "../services/eddsaService";

const KEYPAIR_KEY = "babyJubKeypair";
const testKeypair = {
  version: KEYPAIR_VERSION,
  seed: "00".repeat(32),
  k: "123",
  Ax: "456",
  Ay: "789",
};

describe("Keypair storage boundary", () => {
  beforeEach(() => {
    localStorage.removeItem(KEYPAIR_KEY);
    sessionStorage.removeItem(KEYPAIR_KEY);
  });

  afterEach(() => {
    localStorage.removeItem(KEYPAIR_KEY);
    sessionStorage.removeItem(KEYPAIR_KEY);
  });

  it("storeKeypair writes to sessionStorage, not localStorage", async () => {
    const { storeKeypair } = await import("../services/keypairService");
    storeKeypair(testKeypair);

    expect(sessionStorage.getItem(KEYPAIR_KEY)).not.toBeNull();
    expect(localStorage.getItem(KEYPAIR_KEY)).toBeNull();
  });

  it("getStoredKeypair reads from sessionStorage", async () => {
    const { storeKeypair, getStoredKeypair } = await import("../services/keypairService");
    storeKeypair(testKeypair);

    const retrieved = getStoredKeypair();
    expect(retrieved).toEqual(testKeypair);
  });

  it("clearStoredKeypair removes from sessionStorage", async () => {
    const { storeKeypair, clearStoredKeypair, getStoredKeypair } = await import("../services/keypairService");
    storeKeypair(testKeypair);
    clearStoredKeypair();

    expect(getStoredKeypair()).toBeNull();
  });
});
