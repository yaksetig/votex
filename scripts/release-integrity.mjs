import { spawnSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  readFileSync(join(root, "release.config.json"), "utf8")
);

function fail(message) {
  throw new Error(message);
}

function sameValues(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function localFunctionNames() {
  const functionsRoot = join(root, "supabase", "functions");
  return readdirSync(functionsRoot)
    .filter((name) => name !== "_shared")
    .filter((name) => {
      const directory = join(functionsRoot, name);
      return statSync(directory).isDirectory() && existsSync(join(directory, "index.ts"));
    })
    .sort();
}

function configuredJwtModes() {
  const config = readFileSync(join(root, "supabase", "config.toml"), "utf8");
  const modes = new Map();
  let currentFunction = null;

  for (const line of config.split(/\r?\n/)) {
    const functionSection = line.match(/^\[functions\.([^\]]+)\]\s*$/);
    if (functionSection) {
      currentFunction = functionSection[1];
      continue;
    }
    if (/^\[/.test(line)) {
      currentFunction = null;
      continue;
    }
    const jwtMatch = line.match(/^verify_jwt\s*=\s*(true|false)\s*$/);
    if (currentFunction && jwtMatch) {
      modes.set(currentFunction, jwtMatch[1] === "true");
    }
  }

  return modes;
}

function validateMigrations() {
  const migrationFiles = readdirSync(join(root, "supabase", "migrations"))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const versions = migrationFiles.map((name) => name.split("_", 1)[0]);

  if (new Set(versions).size !== versions.length) {
    fail("Supabase migration versions must be unique");
  }
  if (!migrationFiles.every((name) => /^\d{14}_.*\.sql$/.test(name))) {
    fail("Every Supabase migration must use a 14-digit timestamp prefix");
  }
}

export function validateLocalRelease() {
  if (manifest.schema !== 1) {
    fail("Unsupported release manifest schema");
  }

  const declared = manifest.functions.map(({ name }) => name).sort();
  const local = localFunctionNames();
  if (!sameValues(declared, local)) {
    fail(
      `Edge Function manifest drift. Declared: ${declared.join(", ")}; local: ${local.join(", ")}`
    );
  }

  const jwtModes = configuredJwtModes();
  for (const { name, verifyJwt } of manifest.functions) {
    const configured = jwtModes.get(name) ?? true;
    if (configured !== verifyJwt) {
      fail(
        `${name} verify_jwt drift: release manifest=${verifyJwt}, supabase/config.toml=${configured}`
      );
    }
  }
  for (const name of jwtModes.keys()) {
    if (!declared.includes(name)) {
      fail(`supabase/config.toml contains undeclared Edge Function ${name}`);
    }
  }

  validateMigrations();
  process.stdout.write(
    `Release manifest matches ${declared.length} Edge Functions and the local migration set.\n`
  );
}

function runSupabaseJson(args) {
  const result = spawnSync("supabase", args, {
    cwd: root,
    encoding: "utf8",
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    fail(result.stderr || `supabase ${args.join(" ")} failed`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    fail(`Supabase returned invalid JSON for ${args.join(" ")}`);
  }
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) fail(`Missing required environment variable ${name}`);
  return value;
}

async function fetchWithTimeout(url, init = {}) {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(15_000),
  });
}

async function waitForFrontendRelease(appUrl, expectedSha) {
  const deadline = Date.now() + Number(process.env.RELEASE_WAIT_MS ?? 600_000);
  let lastSeen = "unavailable";

  while (Date.now() < deadline) {
    try {
      const response = await fetchWithTimeout(
        `${appUrl}/release.json?expected=${encodeURIComponent(expectedSha || "current")}&poll=${Date.now()}`,
        { headers: { "cache-control": "no-cache" } }
      );
      if (response.ok) {
        const release = await response.json();
        lastSeen = release.commitSha ?? "missing commitSha";
        if (release.schema === 1 && (!expectedSha || release.commitSha === expectedSha)) {
          return release;
        }
      } else {
        lastSeen = `HTTP ${response.status}`;
      }
    } catch (error) {
      lastSeen = error instanceof Error ? error.message : "request failed";
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 10_000));
  }

  fail(`Frontend did not publish release ${expectedSha}; last observed ${lastSeen}`);
}

function validateLiveFunctionInventory(rows) {
  const liveByName = new Map(rows.map((row) => [row.slug ?? row.name, row]));
  const declared = manifest.functions.map(({ name }) => name).sort();
  const live = [...liveByName.keys()].sort();
  if (!sameValues(declared, live)) {
    fail(`Live Edge Function drift. Declared: ${declared.join(", ")}; live: ${live.join(", ")}`);
  }

  for (const { name, verifyJwt } of manifest.functions) {
    const row = liveByName.get(name);
    if (row.status !== "ACTIVE") fail(`${name} is not ACTIVE`);
    if (row.verify_jwt !== verifyJwt) {
      fail(`${name} live verify_jwt=${row.verify_jwt}; expected ${verifyJwt}`);
    }
  }
}

function validateLiveMigrations(payload) {
  const rows = payload.migrations ?? payload;
  if (!Array.isArray(rows) || rows.length === 0) fail("No migration history returned");
  const drift = rows.filter((row) => !row.local || !row.remote || row.local !== row.remote);
  if (drift.length > 0) {
    fail(`Supabase migration drift detected: ${JSON.stringify(drift)}`);
  }
}

async function validateCors(supabaseUrl, appOrigin) {
  for (const { name } of manifest.functions) {
    const response = await fetchWithTimeout(`${supabaseUrl}/functions/v1/${name}`, {
      method: "OPTIONS",
      headers: {
        Origin: appOrigin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization,apikey,content-type,x-client-info",
      },
    });
    if (!response.ok) fail(`${name} preflight returned HTTP ${response.status}`);
    const allowedOrigin = response.headers.get("access-control-allow-origin");
    if (allowedOrigin !== appOrigin) {
      fail(`${name} allows CORS origin ${allowedOrigin}; expected ${appOrigin}`);
    }
  }
}

async function validateCriticalSurfaces({ appUrl, supabaseUrl, anonKey }) {
  const appResponse = await fetchWithTimeout(appUrl, { redirect: "follow" });
  if (!appResponse.ok) fail(`Application root returned HTTP ${appResponse.status}`);

  const authHeaders = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
  };
  const ledgerResponse = await fetchWithTimeout(
    `${supabaseUrl}/rest/v1/public_elections?select=id&limit=1`,
    { headers: authHeaders }
  );
  if (!ledgerResponse.ok) fail(`Public election ledger returned HTTP ${ledgerResponse.status}`);

  const authorityResponse = await fetchWithTimeout(
    `${supabaseUrl}/functions/v1/fixed-authority-status`,
    { method: "POST", headers: { ...authHeaders, "content-type": "application/json" }, body: "{}" }
  );
  const authority = await authorityResponse.json();
  if (!authorityResponse.ok || !authority.configured || !authority.linked) {
    fail(`Fixed authority is not production-ready: ${JSON.stringify(authority)}`);
  }

  const electionResponse = await fetchWithTimeout(
    `${supabaseUrl}/functions/v1/create-election`,
    { method: "POST", headers: { ...authHeaders, "content-type": "application/json" }, body: "{}" }
  );
  const electionError = await electionResponse.json();
  if (electionResponse.status !== 401 || electionError.code !== "SESSION_REQUIRED") {
    fail(`create-election did not enforce voter sessions: ${JSON.stringify(electionError)}`);
  }

  const rpResponse = await fetchWithTimeout(`${supabaseUrl}/functions/v1/rp-signature`, {
    method: "POST",
    headers: { ...authHeaders, "content-type": "application/json" },
    body: JSON.stringify({ action: "registration" }),
  });
  const rpSignature = await rpResponse.json();
  if (!rpResponse.ok || !rpSignature.sig || !rpSignature.nonce) {
    fail(`rp-signature smoke check failed: ${JSON.stringify(rpSignature)}`);
  }
}

export async function validateLiveRelease() {
  validateLocalRelease();
  const projectRef = requiredEnvironment("SUPABASE_PROJECT_ID");
  const appUrl = new URL(requiredEnvironment("VOTEX_APP_URL"));
  const supabaseUrl = new URL(requiredEnvironment("VITE_SUPABASE_URL"));
  const anonKey = requiredEnvironment("VITE_SUPABASE_ANON_KEY");
  const expectedSha = process.env.EXPECTED_RELEASE_SHA?.trim() ?? "";

  const liveFunctions = runSupabaseJson([
    "functions", "list", "--project-ref", projectRef, "--output-format", "json",
  ]);
  validateLiveFunctionInventory(liveFunctions.functions ?? liveFunctions);

  const secretRows = runSupabaseJson([
    "secrets", "list", "--project-ref", projectRef, "--output-format", "json",
  ]);
  const liveSecretNames = new Set(
    (secretRows.secrets ?? secretRows).map(({ name }) => name)
  );
  const missingSecrets = manifest.requiredSecrets.filter((name) => !liveSecretNames.has(name));
  if (missingSecrets.length > 0) fail(`Missing Supabase secrets: ${missingSecrets.join(", ")}`);

  const migrationPayload = runSupabaseJson([
    "migration", "list", "--linked", "--output-format", "json",
  ]);
  validateLiveMigrations(migrationPayload);

  const release = await waitForFrontendRelease(appUrl.origin, expectedSha);
  await validateCors(supabaseUrl.origin, appUrl.origin);
  await validateCriticalSurfaces({
    appUrl: appUrl.origin,
    supabaseUrl: supabaseUrl.origin,
    anonKey,
  });

  process.stdout.write(
    `Production release ${release.commitSha} passed function, migration, CORS, authority, ledger, and frontend checks.\n`
  );
}

const command = process.argv[2] ?? "local";
if (command === "local") {
  validateLocalRelease();
} else if (command === "live") {
  validateLiveRelease().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : "Release validation failed"}\n`);
    process.exitCode = 1;
  });
} else {
  process.stderr.write("Usage: node scripts/release-integrity.mjs <local|live>\n");
  process.exitCode = 1;
}
