import type { Page, Route } from "@playwright/test";

const SUPABASE_ORIGIN = "https://example.supabase.co";
const AUTHORITY_ID = "11111111-1111-4111-8111-111111111111";
const AUTH_USER_ID = "22222222-2222-4222-8222-222222222222";
const VOTER_ID = "e2e-voter-pseudonym";
const SESSION_TOKEN = "e2e-world-id-session";

type Row = Record<string, unknown>;

export interface VotexTestState {
  elections: Row[];
  participants: Row[];
  votes: Row[];
  yesVotes: Row[];
  noVotes: Row[];
  delegations: Row[];
  accumulators: Row[];
  nullifications: Row[];
  tallies: Row[];
  auditEvents: Row[];
  voterPublicKey: { x: string; y: string } | null;
  sessionValid: boolean;
  unexpectedRequests: string[];
}

const authority: Row = {
  id: AUTHORITY_ID,
  name: "Votex Election Authority",
  description: "Fixed test authority",
  auth_user_id: AUTH_USER_ID,
  public_key_x:
    "10437770494849092789975356179793365921081894825728509282912022721692387900446",
  public_key_y:
    "2421468586826963775234286408733868809034027042237521097949992319631922689348",
  created_at: "2026-07-13T12:00:00.000Z",
  updated_at: "2026-07-13T12:00:00.000Z",
};

const corsHeaders = {
  "access-control-allow-origin": "http://localhost:4173",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
  "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "access-control-expose-headers": "content-range",
};

function encodeJwtPart(value: Row): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function authorityAccessToken(): string {
  return [
    encodeJwtPart({ alg: "none", typ: "JWT" }),
    encodeJwtPart({
      aud: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
      email: "authority@votex.world",
      role: "authenticated",
      sub: AUTH_USER_ID,
    }),
    "e2e-signature",
  ].join(".");
}

function authorityUser(): Row {
  return {
    id: AUTH_USER_ID,
    aud: "authenticated",
    role: "authenticated",
    email: "authority@votex.world",
    email_confirmed_at: "2026-07-13T12:00:00.000Z",
    created_at: "2026-07-13T12:00:00.000Z",
    updated_at: "2026-07-13T12:00:00.000Z",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
  };
}

async function requestJson(route: Route): Promise<Row> {
  const body = route.request().postData();
  if (!body) return {};
  return JSON.parse(body) as Row;
}

async function fulfillJson(route: Route, body: unknown, status = 200, headers: Row = {}) {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: { ...corsHeaders, ...headers } as Record<string, string>,
    body: JSON.stringify(body),
  });
}

function decodeFilter(value: string): unknown {
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;
  return decodeURIComponent(value);
}

function filteredRows(rows: Row[], url: URL): Row[] {
  let filtered = [...rows];
  for (const [column, expression] of url.searchParams.entries()) {
    if (["select", "order", "limit", "offset"].includes(column)) continue;
    if (expression.startsWith("eq.")) {
      const expected = decodeFilter(expression.slice(3));
      filtered = filtered.filter((row) => String(row[column]) === String(expected));
    } else if (expression.startsWith("in.(") && expression.endsWith(")")) {
      const expected = new Set(
        expression
          .slice(4, -1)
          .split(",")
          .map((value) => String(decodeFilter(value)))
      );
      filtered = filtered.filter((row) => expected.has(String(row[column])));
    }
  }

  const limitValue = url.searchParams.get("limit");
  const limit = limitValue === null ? null : Number(limitValue);
  if (limit !== null && Number.isFinite(limit) && limit >= 0) {
    filtered = filtered.slice(0, limit);
  }
  return filtered;
}

function tableRows(table: string, state: VotexTestState): Row[] | null {
  switch (table) {
    case "public_elections":
    case "elections":
      return state.elections;
    case "public_election_authorities":
    case "election_authorities":
      return [authority];
    case "public_votes":
      return state.votes;
    case "public_participants":
      return state.participants;
    case "yes_votes":
      return state.yesVotes;
    case "no_votes":
      return state.noVotes;
    case "public_delegations":
      return state.delegations;
    case "public_nullification_accumulators":
      return state.accumulators;
    case "public_nullifications":
      return state.nullifications;
    case "public_tallies":
    case "election_tallies":
      return state.tallies;
    case "election_authority_audit_log":
      return state.auditEvents;
    default:
      return null;
  }
}

async function handleRest(route: Route, state: VotexTestState, url: URL) {
  const path = url.pathname.replace("/rest/v1/", "");
  if (path === "rpc/close_election_atomic") {
    const body = await requestJson(route);
    const election = state.elections.find((row) => row.id === body.p_election_id);
    if (election && !election.closed_manually_at) {
      election.closed_manually_at = new Date().toISOString();
      election.status = "closed_manually";
      state.auditEvents.push({
        id: crypto.randomUUID(),
        election_id: election.id,
        action: "CLOSE_ELECTION",
        created_at: new Date().toISOString(),
      });
    }
    await fulfillJson(route, true);
    return;
  }

  const rows = tableRows(path, state);
  if (!rows) {
    state.unexpectedRequests.push(`${route.request().method()} ${url.pathname}`);
    await fulfillJson(route, { message: `Unhandled test table ${path}` }, 500);
    return;
  }

  if (route.request().method() === "POST") {
    const body = await requestJson(route);
    const inserted = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...body };
    rows.push(inserted);
    await fulfillJson(route, [inserted]);
    return;
  }

  if (route.request().method() === "PATCH") {
    const body = await requestJson(route);
    const selected = filteredRows(rows, url);
    selected.forEach((row) => Object.assign(row, body));
    await fulfillJson(route, selected);
    return;
  }

  const selected = filteredRows(rows, url);
  const countHeader = selected.length === 0 ? "*/0" : `0-${selected.length - 1}/${selected.length}`;
  if (route.request().method() === "HEAD") {
    await route.fulfill({ status: 200, headers: { ...corsHeaders, "content-range": countHeader } });
    return;
  }

  const accept = route.request().headers().accept ?? "";
  const responseBody = accept.includes("application/vnd.pgrst.object+json")
    ? selected[0] ?? null
    : selected;
  await fulfillJson(route, responseBody, 200, { "content-range": countHeader });
}

async function handleFunction(route: Route, state: VotexTestState, functionName: string) {
  const body = await requestJson(route);
  const now = new Date().toISOString();

  switch (functionName) {
    case "rp-signature":
      await fulfillJson(route, {
        nonce: "e2e-rp-nonce",
        created_at: Math.floor(Date.now() / 1000),
        expires_at: Math.floor(Date.now() / 1000) + 600,
        sig: "e2e-rp-signature",
      });
      return;
    case "fixed-authority-status":
      await fulfillJson(route, {
        configured: true,
        linked: true,
        authorityName: authority.name,
      });
      return;
    case "register-keypair": {
      const alreadyExists = state.voterPublicKey !== null;
      state.voterPublicKey = body.pk as { x: string; y: string };
      await fulfillJson(route, { success: true, alreadyExists });
      return;
    }
    case "worldid-session":
      if (body.action === "validate") {
        await fulfillJson(route, state.sessionValid && body.sessionToken === SESSION_TOKEN
          ? { valid: true, userId: VOTER_ID, expiresAt: "2099-01-01T00:00:00.000Z" }
          : { valid: false });
        return;
      }
      if (body.action === "revoke") {
        state.sessionValid = false;
        await fulfillJson(route, { success: true });
        return;
      }
      state.sessionValid = true;
      await fulfillJson(route, {
        sessionToken: SESSION_TOKEN,
        userId: VOTER_ID,
        expiresAt: "2099-01-01T00:00:00.000Z",
      });
      return;
    case "create-election": {
      const election: Row = {
        id: crypto.randomUUID(),
        title: body.title,
        description: body.description,
        option1: body.option1,
        option2: body.option2,
        end_date: body.endDate,
        created_at: now,
        creator: VOTER_ID,
        authority_id: AUTHORITY_ID,
        status: "active",
        closed_manually_at: null,
        last_modified_at: null,
        last_modified_by: null,
      };
      state.elections.push(election);
      state.participants.push({
        id: crypto.randomUUID(),
        election_id: election.id,
        voter_pseudonym: "e2e-delegate-pseudonym",
        public_key_x: authority.public_key_x,
        public_key_y: authority.public_key_y,
        joined_at: "2026-07-13T12:01:00.000Z",
      });
      await fulfillJson(route, { election, authorityId: AUTHORITY_ID });
      return;
    }
    case "register-participant": {
      const existing = state.participants.find(
        (row) => row.election_id === body.electionId && row.voter_pseudonym === VOTER_ID
      );
      if (!existing) {
        const publicKey = body.publicKey as { x: string; y: string };
        state.participants.push({
          id: crypto.randomUUID(),
          election_id: body.electionId,
          voter_pseudonym: VOTER_ID,
          public_key_x: publicKey.x,
          public_key_y: publicKey.y,
          joined_at: now,
        });
        for (let index = 0; index < 4; index += 1) {
          state.participants.push({
            id: crypto.randomUUID(),
            election_id: body.electionId,
            voter_pseudonym: `e2e-cover-pseudonym-${index + 1}`,
            public_key_x: authority.public_key_x,
            public_key_y: authority.public_key_y,
            joined_at: new Date(Date.now() + index + 1).toISOString(),
          });
        }
      }
      await fulfillJson(route, { success: true });
      return;
    }
    case "delegation-write": {
      const existing = state.delegations.find(
        (row) => row.election_id === body.electionId && row.delegator_pseudonym === VOTER_ID
      );
      if (body.action === "revoke") {
        if (existing) {
          existing.status = "revoked";
          existing.revoked_at = now;
        }
      } else {
        const ciphertext = body.ciphertext as {
          c1: { x: string; y: string };
          c2: { x: string; y: string };
        };
        const row = existing ?? {
          id: crypto.randomUUID(),
          election_id: body.electionId,
          delegator_pseudonym: VOTER_ID,
          created_at: now,
        };
        Object.assign(row, {
          delegate_ct_c1_x: ciphertext.c1.x,
          delegate_ct_c1_y: ciphertext.c1.y,
          delegate_ct_c2_x: ciphertext.c2.x,
          delegate_ct_c2_y: ciphertext.c2.y,
          status: "active",
          revoked_at: null,
        });
        if (!existing) state.delegations.push(row);
      }
      await fulfillJson(route, { success: true });
      return;
    }
    case "vote-tracking-write": {
      let vote = state.votes.find(
        (row) => row.election_id === body.electionId && row.voter_pseudonym === VOTER_ID
      );
      if (!vote) {
        vote = {
          receipt_id: crypto.randomUUID(),
          election_id: body.electionId,
          voter_pseudonym: VOTER_ID,
          choice: body.choice,
          signature: body.signature,
          signed_at: body.timestamp,
          accepted_at: now,
        };
        state.votes.push(vote);
        const tracking = {
          id: crypto.randomUUID(),
          election_id: body.electionId,
          voter_id: VOTER_ID,
          nullified: false,
        };
        const election = state.elections.find((row) => row.id === body.electionId);
        (body.choice === election?.option1 ? state.yesVotes : state.noVotes).push(tracking);
      }
      await fulfillJson(route, {
        success: true,
        receipt: {
          receiptId: vote.receipt_id,
          electionId: vote.election_id,
          electionTitle: state.elections.find((row) => row.id === vote?.election_id)?.title,
          voterPseudonym: vote.voter_pseudonym,
          choice: vote.choice,
          signature: vote.signature,
          signedAt: vote.signed_at,
          acceptedAt: vote.accepted_at,
          signatureVerified: true,
        },
      });
      return;
    }
    case "authority-tally-write": {
      state.tallies.splice(0, state.tallies.length);
      const results = Array.isArray(body.results) ? body.results as Row[] : [];
      results.forEach((result) => state.tallies.push({
        id: crypto.randomUUID(),
        election_id: body.electionId,
        user_id: result.userId,
        voter_pseudonym: result.userId,
        nullification_count: result.nullificationCount,
        vote_nullified: result.voteNullified,
        vote_weight: result.voteWeight,
        processed_at: now,
        processed_by: body.processedBy,
      }));
      await fulfillJson(route, { success: true, tallyRunId: crypto.randomUUID() });
      return;
    }
    case "nullification-write": {
      const submitted = Array.isArray(body.nullifications) ? body.nullifications as Row[] : [];
      submitted.forEach((nullification) => state.nullifications.push({
        id: crypto.randomUUID(),
        election_id: body.electionId,
        submitter_pseudonym: VOTER_ID,
        target_pseudonym: nullification.userId,
        nullifier_zkp: nullification.zkp,
        created_at: now,
      }));
      await fulfillJson(route, { success: true, count: submitted.length });
      return;
    }
    default:
      state.unexpectedRequests.push(`POST /functions/v1/${functionName}`);
      await fulfillJson(route, { code: "UNHANDLED_E2E_FUNCTION" }, 500);
  }
}

async function handleAuth(route: Route, url: URL) {
  if (url.pathname.endsWith("/logout")) {
    await route.fulfill({ status: 204, headers: corsHeaders });
    return;
  }

  const user = authorityUser();
  if (url.pathname.endsWith("/user")) {
    await fulfillJson(route, user);
    return;
  }

  await fulfillJson(route, {
    access_token: authorityAccessToken(),
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "e2e-refresh-token",
    user,
  });
}

export async function installVotexBackend(page: Page): Promise<VotexTestState> {
  const state: VotexTestState = {
    elections: [],
    participants: [],
    votes: [],
    yesVotes: [],
    noVotes: [],
    delegations: [],
    accumulators: [],
    nullifications: [],
    tallies: [],
    auditEvents: [],
    voterPublicKey: null,
    sessionValid: false,
    unexpectedRequests: [],
  };

  await page.route(`${SUPABASE_ORIGIN}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 200, headers: corsHeaders });
      return;
    }
    if (url.pathname.startsWith("/functions/v1/")) {
      await handleFunction(route, state, url.pathname.split("/").pop() ?? "");
      return;
    }
    if (url.pathname.startsWith("/rest/v1/")) {
      await handleRest(route, state, url);
      return;
    }
    if (url.pathname.startsWith("/auth/v1/")) {
      await handleAuth(route, url);
      return;
    }

    state.unexpectedRequests.push(`${request.method()} ${url.pathname}`);
    await fulfillJson(route, { message: "Unhandled test request" }, 500);
  });

  return state;
}

export async function installDeterministicPasskey(page: Page) {
  await page.addInitScript(() => {
    const credentialId = Uint8Array.from([1, 3, 3, 7]).buffer;
    const prfSecret = Uint8Array.from({ length: 32 }, (_, index) => index + 1).buffer;

    class TestPublicKeyCredential {
      static async isUserVerifyingPlatformAuthenticatorAvailable() {
        return true;
      }

      readonly rawId = credentialId;
      readonly id = "AQMDBw==";
      readonly type = "public-key";

      constructor(private readonly mode: "create" | "get") {}

      getClientExtensionResults() {
        return this.mode === "create"
          ? { prf: { enabled: true } }
          : { prf: { results: { first: prfSecret } } };
      }
    }

    Object.defineProperty(window, "PublicKeyCredential", {
      configurable: true,
      value: TestPublicKeyCredential,
    });
    Object.defineProperty(navigator, "credentials", {
      configurable: true,
      value: {
        create: async () => new TestPublicKeyCredential("create"),
        get: async () => new TestPublicKeyCredential("get"),
      },
    });
  });
}
