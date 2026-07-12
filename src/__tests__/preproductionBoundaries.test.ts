import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));

function read(relativePath: string): Buffer {
  return readFileSync(`${root}${relativePath}`);
}

function sha256(relativePath: string): string {
  return createHash("sha256").update(read(relativePath)).digest("hex");
}

describe("pre-production trust boundaries", () => {
  it("keeps the reviewed cryptographic circuit and artifacts byte-for-byte unchanged", () => {
    expect(sha256("public/circuits/nullification_xor.wasm"))
      .toBe("a3dfbc1746a88d8889cb7e642bc9c87b399b3936718250dd3361265709068393");
    expect(sha256("public/circuits/nullification_xor_final.zkey"))
      .toBe("423a6d848fae7482ea3d533efe1bc2191cf7831ce5cb79684b4a383703ff3adc");
    expect(sha256("public/circuits/verification_key_xor.json"))
      .toBe("fb5c33f7501fe411ac72d30ddeb5e8d271277d605207188b634bead5d090721d");
    expect(sha256("circuits/nullification_xor.circom"))
      .toBe("38977a67c8465c83ca5b41938ca6361afc6749c1fd3347b5a1fd829034e49ebb");
  });

  it("closes direct election creation and grants transactional writes only to service_role", () => {
    const migration = read("supabase/migrations/20260712000000_preproduction_hardening.sql").toString("utf8");
    expect(migration).toContain('CREATE POLICY "No direct client inserts into elections"');
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.create_election_atomic");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.cast_vote_atomic");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.write_delegation_atomic");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.store_tally_results_atomic");
    expect(migration).toContain("TO service_role;");
  });

  it("exposes deliberate public audit projections instead of internal tables", () => {
    const migration = read("supabase/migrations/20260712000000_preproduction_hardening.sql").toString("utf8");
    expect(migration).toContain("CREATE OR REPLACE VIEW public.public_votes");
    expect(migration).toContain("CREATE OR REPLACE VIEW public.public_elections");
    expect(migration).toContain("CREATE OR REPLACE VIEW public.public_participants");
    expect(migration).toContain("CREATE OR REPLACE VIEW public.public_delegations");
    expect(migration).toContain("CREATE OR REPLACE VIEW public.public_nullifications");
    expect(migration).toContain("CREATE OR REPLACE VIEW public.public_nullification_accumulators");
    expect(migration).toContain("voter AS voter_pseudonym");
    expect(migration).toContain("id AS receipt_id");
    expect(migration).toContain("REVOKE ALL ON public.votes FROM anon, authenticated");
    expect(migration).toContain("REVOKE ALL ON public.election_participants FROM anon, authenticated");
    expect(migration).toContain("REVOKE ALL ON public.delegations FROM anon, authenticated");
    expect(migration).toContain("REVOKE ALL ON public.nullifications FROM anon, authenticated");
  });
});
