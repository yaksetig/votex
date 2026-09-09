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
    const config = JSON.parse(read("release.config.json").toString("utf8")) as {
      circuitArtifacts: Record<string, string>;
    };
    const pins = config.circuitArtifacts;
    expect(Object.keys(pins).sort()).toEqual([
      "circuits/nullification_xor.circom",
      "public/circuits/nullification_xor.wasm",
      "public/circuits/nullification_xor_final.zkey",
      "public/circuits/verification_key_xor.json",
    ]);
    for (const [relativePath, expected] of Object.entries(pins)) {
      expect(expected).toMatch(/^[0-9a-f]{64}$/);
      expect(sha256(relativePath), relativePath).toBe(expected);
    }
  });

  it("ships one verification key: JSON artifact and edge-function module agree", () => {
    const json = JSON.parse(read("public/circuits/verification_key_xor.json").toString("utf8"));
    const module = read("supabase/functions/_shared/verificationKeyXor.ts").toString("utf8");
    const embedded = JSON.parse(module.slice(module.indexOf("= ") + 2).replace(/;\s*$/, ""));
    expect(embedded).toEqual(json);
    expect(json.nPublic).toBe(17);
    expect(json.IC).toHaveLength(18);
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

  it("enforces the audit remediation boundaries in the latest migration", () => {
    const migration = read("supabase/migrations/20260820000000_security_audit_remediation.sql").toString("utf8");
    expect(migration).toContain('DROP POLICY IF EXISTS "Election authorities can update elections"');
    expect(migration).toContain("REVOKE INSERT, UPDATE, DELETE ON public.election_authority_audit_log");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.update_election_details_atomic");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.record_authority_authentication");
    expect(migration).toContain("MESSAGE = 'INCOMPLETE_TALLY_RESULTS'");
    expect(migration).toContain("CREATE OR REPLACE VIEW public.public_election_activity");
    expect(migration).toContain("delegations_canonical_ciphertext_coordinates");
  });

  it("strips write privileges from every public projection and makes new objects deny-by-default", () => {
    const migration = read("supabase/migrations/20260909000000_revoke_view_writes_and_sql_cleanup.sql").toString("utf8");
    expect(migration).toContain("REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER");
    for (const view of [
      "public_votes",
      "public_elections",
      "public_participants",
      "public_delegations",
      "public_nullifications",
      "public_nullification_accumulators",
      "public_election_authorities",
      "public_authority_audit_events",
      "public_tallies",
      "public_election_activity",
    ]) {
      expect(migration).toContain(`public.${view}`);
    }
    expect(migration).toContain("ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public\n  REVOKE ALL ON TABLES FROM anon, authenticated");
    expect(migration).toContain("ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public\n  REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("DROP TABLE IF EXISTS public.discrete_log_lookup");
    expect(migration).toContain("WHERE election_id IS NOT NULL");
  });
});
