/**
 * @vitest-environment jsdom
 */

/**
 * A logout in one tab must clear the voting seed and the verified state in
 * every other tab. WalletContext listens for the shared session key being
 * removed from localStorage (the `storage` event only fires in OTHER tabs).
 */

import React, { useEffect } from "react";
import { act, render } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStorage } from "./helpers/memoryStorage";

vi.mock("@/services/worldIdSessionService", () => ({
  SESSION_STORAGE_KEY: "votex:worldid:session",
  validateStoredWorldIdSession: vi.fn().mockResolvedValue({ userId: "0xabc", token: "t", expiresAt: "2999-01-01T00:00:00Z" }),
  revokeStoredWorldIdSession: vi.fn().mockResolvedValue(true),
}));
// A stable toast reference: the provider's restore effect depends on it, so a
// fresh function per render would re-run the restore after every state change.
const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

beforeAll(() => {
  Object.defineProperty(window, "localStorage", { configurable: true, value: new MemoryStorage() });
  Object.defineProperty(window, "sessionStorage", { configurable: true, value: new MemoryStorage() });
});

describe("WalletContext cross-tab logout", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it("clears the stored keypair and verified state when another tab removes the session", async () => {
    const { WalletProvider, useWallet } = await import("../contexts/WalletContext");
    const { storeKeypair, getStoredKeypair } = await import("../services/keypairService");
    let latest: ReturnType<typeof useWallet> | null = null;

    function Probe() {
      const wallet = useWallet();
      useEffect(() => {
        latest = wallet;
      });
      return null;
    }

    render(
      <WalletProvider>
        <Probe />
      </WalletProvider>
    );

    // The provider restores the (mocked) server-validated session on mount.
    await act(async () => {
      await Promise.resolve();
      storeKeypair({ version: "eddsa-seed-v1", seed: "00".repeat(32), k: "1", Ax: "2", Ay: "3" });
    });
    expect(latest!.isWorldIDVerified).toBe(true);
    expect(latest!.userId).toBe("0xabc");
    expect(getStoredKeypair()).not.toBeNull();

    // An unrelated key change must not log the tab out.
    await act(async () => {
      window.dispatchEvent(new StorageEvent("storage", { key: "something-else", newValue: null }));
    });
    expect(latest!.isWorldIDVerified).toBe(true);

    await act(async () => {
      window.dispatchEvent(new StorageEvent("storage", { key: "votex:worldid:session", newValue: null }));
    });
    expect(latest!.isWorldIDVerified).toBe(false);
    expect(latest!.userId).toBeNull();
    expect(getStoredKeypair()).toBeNull();
  });
});
