import { describe, expect, it } from "vitest";
import { exportableReceipt, parsePastedReceipt } from "@/lib/receipt";

const receipt = {
  receiptId: "r-1",
  electionId: "e-1",
  electionTitle: "Budget",
  voterPseudonym: "0xabc",
  choice: "Yes",
  signature: "{\"R8\":{},\"S\":\"1\"}",
  signedAt: 1_700_000_000_000,
  acceptedAt: "2026-07-13T12:00:00.000Z",
  signatureVerified: true,
};

describe("exportableReceipt", () => {
  it("drops the local verification flag so a third party cannot be misled by it", () => {
    const exported = exportableReceipt(receipt);
    expect("signatureVerified" in exported).toBe(false);
    expect(exported.receiptId).toBe("r-1");
  });
});

describe("parsePastedReceipt", () => {
  it("accepts an exported receipt and tolerates a missing title", () => {
    const { electionTitle: _title, ...withoutTitle } = exportableReceipt(receipt);
    const parsed = parsePastedReceipt(JSON.stringify(withoutTitle));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.receipt.electionTitle).toBe("");
      expect(parsed.receipt.signedAt).toBe(receipt.signedAt);
    }
  });

  it("explains what is wrong with bad input", () => {
    expect(parsePastedReceipt("not json")).toMatchObject({ ok: false, error: expect.stringMatching(/not valid JSON/) });
    expect(parsePastedReceipt("[]")).toMatchObject({ ok: false, error: expect.stringMatching(/JSON object/) });
    expect(parsePastedReceipt(JSON.stringify({ ...receipt, signature: "" }))).toMatchObject({
      ok: false,
      error: expect.stringMatching(/"signature"/),
    });
    expect(parsePastedReceipt(JSON.stringify({ ...receipt, signedAt: "soon" }))).toMatchObject({
      ok: false,
      error: expect.stringMatching(/signedAt/),
    });
  });
});
