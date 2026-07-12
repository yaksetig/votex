/**
 * @vitest-environment jsdom
 */

/**
 * VTX-013 / VTX-010: Keypair session-storage boundary tests.
 * Requires a DOM environment (jsdom) for localStorage/sessionStorage.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { KEYPAIR_VERSION } from "../services/eddsaService";

const KEYPAIR_KEY = "babyJubKeypair";
const testKeypair = {
  version: KEYPAIR_VERSION,
  seed: "00".repeat(32),
  k: "123",
  Ax: "456",
  Ay: "789",
};

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

beforeAll(() => {
  // Node 22+ exposes an unavailable localStorage global that can mask jsdom's
  // implementation. Install deterministic per-window stores for this boundary
  // test rather than relying on the host runtime flag.
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: new MemoryStorage(),
  });
  Object.defineProperty(window, "sessionStorage", {
    configurable: true,
    value: new MemoryStorage(),
  });
});

describe("Keypair storage boundary", () => {
  beforeEach(() => {
    window.localStorage.removeItem(KEYPAIR_KEY);
    window.sessionStorage.removeItem(KEYPAIR_KEY);
  });

  afterEach(() => {
    window.localStorage.removeItem(KEYPAIR_KEY);
    window.sessionStorage.removeItem(KEYPAIR_KEY);
  });

  it("storeKeypair writes to sessionStorage, not localStorage", async () => {
    const { storeKeypair } = await import("../services/keypairService");
    storeKeypair(testKeypair);

    expect(window.sessionStorage.getItem(KEYPAIR_KEY)).not.toBeNull();
    expect(window.localStorage.getItem(KEYPAIR_KEY)).toBeNull();
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
