import { spawnSync } from "node:child_process";
import { hkdfSync } from "node:crypto";
import process from "node:process";
import { createInterface } from "node:readline/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildEddsa } from "circomlibjs";

const HKDF_SALT = Buffer.from("votex:eddsa:seed-derivation", "utf8");
const AUTHORITY_SEED_INFO = Buffer.from(
  "votex:eddsa:authority-seed:v1",
  "utf8"
);
const PLACEHOLDER_PUBLIC_KEY = {
  x: "5299619240641551281634865583518297030282874472190772894086521144482721001553",
  y: "16950150798460657717958625567821834550301663161624707787222815936182638968203",
};
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readFlag(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function sqlLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

async function promptForName() {
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    return (await readline.question("Authority name: ")).trim();
  } finally {
    readline.close();
  }
}

async function promptHidden(message) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
    throw new Error("Authority bootstrap requires an interactive terminal");
  }

  process.stdout.write(message);
  process.stdin.setRawMode(true);
  process.stdin.resume();

  return await new Promise((resolve, reject) => {
    let value = "";

    const cleanup = () => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
    };

    const onData = (chunk) => {
      for (const character of chunk.toString("utf8")) {
        if (character === "\u0003") {
          cleanup();
          reject(new Error("Authority bootstrap cancelled"));
          return;
        }

        if (character === "\r" || character === "\n") {
          cleanup();
          resolve(value);
          return;
        }

        if (character === "\u007f" || character === "\b") {
          value = value.slice(0, -1);
          continue;
        }

        value += character;
      }
    };

    process.stdin.on("data", onData);
  });
}

export async function deriveAuthorityPublicKey(authoritySecret) {
  const normalizedSecret = authoritySecret.trim();
  if (!normalizedSecret) {
    throw new Error("Authority secret is required");
  }

  const seed = Buffer.from(
    hkdfSync(
      "sha256",
      Buffer.from(normalizedSecret, "utf8"),
      HKDF_SALT,
      AUTHORITY_SEED_INFO,
      32
    )
  );

  try {
    const eddsa = await buildEddsa();
    const point = eddsa.prv2pub(seed);
    return {
      x: BigInt(eddsa.F.toObject(point[0])).toString(),
      y: BigInt(eddsa.F.toObject(point[1])).toString(),
    };
  } finally {
    seed.fill(0);
  }
}

async function main() {
  const authorityId = readFlag("--authority-id")?.trim();
  if (!authorityId || !UUID_PATTERN.test(authorityId)) {
    throw new Error("Pass the configured UUID with --authority-id <uuid>");
  }

  const authorityName = await promptForName();
  if (authorityName.length < 3 || authorityName.length > 100) {
    throw new Error("Authority name must contain between 3 and 100 characters");
  }

  let authoritySecret = await promptHidden(
    "Authority secret (input hidden; it will not be stored): "
  );
  const publicKey = await deriveAuthorityPublicKey(authoritySecret);
  authoritySecret = "";

  if (
    publicKey.x === PLACEHOLDER_PUBLIC_KEY.x &&
    publicKey.y === PLACEHOLDER_PUBLIC_KEY.y
  ) {
    throw new Error("The derived key is the forbidden placeholder authority key");
  }

  const sql = [
    "insert into public.election_authorities",
    "(id, name, description, public_key_x, public_key_y)",
    "values (",
    `${sqlLiteral(authorityId)},`,
    `${sqlLiteral(authorityName)},`,
    "'Fixed Election Authority for Votex',",
    `${sqlLiteral(publicKey.x)},`,
    `${sqlLiteral(publicKey.y)}`,
    ");",
  ].join(" ");

  const result = spawnSync(
    "supabase",
    ["db", "query", "--linked", sql],
    { stdio: "inherit" }
  );

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error("Supabase rejected the fixed authority row");
  }

  process.stdout.write(
    "Fixed authority row created. Continue in /election_authority to create and link the authority account.\n"
  );
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Authority bootstrap failed"}\n`
    );
    process.exitCode = 1;
  });
}
