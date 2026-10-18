import type { VoteReceipt } from "@/types/api";

/** The public facts of a receipt; never the local verification flag, which a third party cannot check. */
export type ExportedReceipt = Omit<VoteReceipt, "signatureVerified">;

export function exportableReceipt(receipt: VoteReceipt): ExportedReceipt {
  const { signatureVerified: _omit, ...rest } = receipt;
  return rest;
}

export type ParsedReceipt = { ok: true; receipt: ExportedReceipt } | { ok: false; error: string };

const REQUIRED_STRINGS = ["receiptId", "electionId", "voterPseudonym", "choice", "signature", "acceptedAt"] as const;

/** Parses receipt JSON pasted by a voter or observer; tolerant of extra fields, strict on the required ones. */
export function parsePastedReceipt(text: string): ParsedReceipt {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, error: "That is not valid JSON. Paste the whole receipt, including the braces." };
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, error: "A receipt is a JSON object with receiptId, electionId, voterPseudonym, choice, signature, signedAt and acceptedAt." };
  }
  const record = value as Record<string, unknown>;
  for (const field of REQUIRED_STRINGS) {
    if (typeof record[field] !== "string" || !(record[field] as string).trim()) {
      return { ok: false, error: `The receipt is missing "${field}".` };
    }
  }
  const signedAt = typeof record.signedAt === "number" ? record.signedAt : Number(record.signedAt);
  if (!Number.isFinite(signedAt)) {
    return { ok: false, error: 'The receipt is missing a numeric "signedAt".' };
  }
  return {
    ok: true,
    receipt: {
      receiptId: record.receiptId as string,
      electionId: record.electionId as string,
      electionTitle: typeof record.electionTitle === "string" ? record.electionTitle : "",
      voterPseudonym: record.voterPseudonym as string,
      choice: record.choice as string,
      signature: record.signature as string,
      signedAt,
      acceptedAt: record.acceptedAt as string,
    },
  };
}
