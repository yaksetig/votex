import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { poseidon5 } from "https://esm.sh/poseidon-lite@0.3.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CURVE_ORDER =
  2736030358979909402780800718157159386076813972158567259200215660948447373041n;
const FIELD_SIZE =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;
const BABYJUBJUB_D = 168696n;
const BABYJUBJUB_A = 168700n;
const BASE_POINT = {
  x: 5299619240641551281634865583518297030282874472190772894086521144482721001553n,
  y: 16950150798460657717958625567821834550301663161624707787222815936182638968203n,
};
const DEFAULT_AUTHORITY_NAME = "Default Election Authority";
const MAX_PROOF_AGE_MS = 5 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 60 * 1000;

interface AuthorityLinkRequest {
  action?: "link";
  authorityName: string;
  issuedAt: number;
  publicKeyX: string;
  publicKeyY: string;
  signature: string;
}

class EdwardsPoint {
  x: bigint;
  y: bigint;

  constructor(x: bigint, y: bigint) {
    this.x = mod(x, FIELD_SIZE);
    this.y = mod(y, FIELD_SIZE);
  }

  static base(): EdwardsPoint {
    return new EdwardsPoint(BASE_POINT.x, BASE_POINT.y);
  }

  isOnCurve(): boolean {
    const x2 = (this.x * this.x) % FIELD_SIZE;
    const y2 = (this.y * this.y) % FIELD_SIZE;
    const left = (BABYJUBJUB_A * x2 + y2) % FIELD_SIZE;
    const right = (1n + BABYJUBJUB_D * x2 * y2) % FIELD_SIZE;
    return left === right;
  }

  add(other: EdwardsPoint): EdwardsPoint {
    const x1y2 = (this.x * other.y) % FIELD_SIZE;
    const y1x2 = (this.y * other.x) % FIELD_SIZE;
    const y1y2 = (this.y * other.y) % FIELD_SIZE;
    const x1x2 = (this.x * other.x) % FIELD_SIZE;
    const dx1x2y1y2 = (BABYJUBJUB_D * x1x2 * y1y2) % FIELD_SIZE;

    const x3Numerator = (x1y2 + y1x2) % FIELD_SIZE;
    const x3Denominator = modInverse((1n + dx1x2y1y2) % FIELD_SIZE, FIELD_SIZE);
    const y3Numerator = (y1y2 - BABYJUBJUB_A * x1x2) % FIELD_SIZE;
    const y3Denominator = modInverse(
      (1n - dx1x2y1y2 + FIELD_SIZE) % FIELD_SIZE,
      FIELD_SIZE
    );

    if (x3Denominator === null || y3Denominator === null) {
      throw new Error("Point addition failed");
    }

    return new EdwardsPoint(
      (x3Numerator * x3Denominator) % FIELD_SIZE,
      (y3Numerator * y3Denominator) % FIELD_SIZE
    );
  }

  multiply(scalar: bigint): EdwardsPoint {
    let result = new EdwardsPoint(0n, 1n);
    let addend = new EdwardsPoint(this.x, this.y);
    let k = scalar;

    while (k > 0n) {
      if (k & 1n) {
        result = result.add(addend);
      }
      addend = addend.add(addend);
      k >>= 1n;
    }

    return result;
  }

  equals(other: EdwardsPoint): boolean {
    return this.x === other.x && this.y === other.y;
  }
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function mod(a: bigint, m: bigint): bigint {
  return ((a % m) + m) % m;
}

function modInverse(a: bigint, m: bigint): bigint | null {
  if (a < 0n) {
    a = mod(a, m);
  }

  let oldR = a;
  let r = m;
  let oldS = 1n;
  let s = 0n;

  while (r !== 0n) {
    const quotient = oldR / r;
    [oldR, r] = [r, oldR - quotient * r];
    [oldS, s] = [s, oldS - quotient * s];
  }

  return oldR > 1n ? null : mod(oldS, m);
}

function toBytesBE(value: bigint): Uint8Array {
  const output = new Uint8Array(32);
  let current = value;

  for (let index = 31; index >= 0; index--) {
    output[index] = Number(current & 0xffn);
    current >>= 8n;
  }

  return output;
}

function stringToBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256(message: Uint8Array): Promise<Uint8Array> {
  const buffer = new ArrayBuffer(message.length);
  new Uint8Array(buffer).set(message);
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return new Uint8Array(digest);
}

async function hashToScalarBE(...parts: Uint8Array[]): Promise<bigint> {
  const message = Uint8Array.from(parts.flatMap((part) => [...part]));
  const digest = await sha256(message);
  return BigInt(`0x${bytesToHex(digest)}`) % CURVE_ORDER;
}

function buildAuthorityLinkMessage(
  authUserId: string,
  publicKey: { x: string; y: string },
  authorityName: string,
  issuedAt: number
): string {
  return [
    "votex:authority-link:v1",
    authUserId,
    publicKey.x,
    publicKey.y,
    authorityName,
    issuedAt.toString(),
  ].join(":");
}

async function hashMessageToField(message: string): Promise<bigint> {
  const bytes = stringToBytes(message);
  const digest = await sha256(bytes);
  return BigInt(`0x${bytesToHex(digest)}`) % CURVE_ORDER;
}

async function verifyAuthorityOwnershipProof(
  authUserId: string,
  authorityName: string,
  publicKey: { x: string; y: string },
  issuedAt: number,
  signature: string
): Promise<boolean> {
  const expectedMessage = buildAuthorityLinkMessage(
    authUserId,
    publicKey,
    authorityName,
    issuedAt
  );

  const parsed = JSON.parse(signature) as {
    R8?: { x?: string; y?: string };
    S?: string;
    message?: string;
  };

  if (!parsed.R8?.x || !parsed.R8?.y || !parsed.S || parsed.message !== expectedMessage) {
    return false;
  }

  const S = BigInt(parsed.S);
  if (S < 0n || S >= CURVE_ORDER) {
    return false;
  }

  const R = new EdwardsPoint(BigInt(parsed.R8.x), BigInt(parsed.R8.y));
  const A = new EdwardsPoint(BigInt(publicKey.x), BigInt(publicKey.y));

  if (!R.isOnCurve() || !A.isOnCurve()) {
    return false;
  }

  // EdDSA-Poseidon verification: S * Base8 == R + h * A
  const msgField = await hashMessageToField(expectedMessage);
  const h = poseidon5([R.x, R.y, A.x, A.y, msgField]) % CURVE_ORDER;

  const lhs = EdwardsPoint.base().multiply(S);
  const rhs = R.add(A.multiply(h));
  return lhs.equals(rhs);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(401, { error: "Missing authorization header" });
    }

    const body = (await req.json()) as AuthorityLinkRequest;
    if (body.action && body.action !== "link") {
      return jsonResponse(400, { error: "Unsupported action" });
    }

    if (
      !body.authorityName?.trim() ||
      !body.publicKeyX ||
      !body.publicKeyY ||
      !body.signature ||
      !Number.isFinite(body.issuedAt)
    ) {
      return jsonResponse(400, { error: "Missing authority link proof fields" });
    }

    const now = Date.now();
    if (body.issuedAt > now + MAX_FUTURE_SKEW_MS) {
      return jsonResponse(400, { error: "Authority proof timestamp is in the future" });
    }

    if (now - body.issuedAt > MAX_PROOF_AGE_MS) {
      return jsonResponse(400, { error: "Authority proof has expired" });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      console.error("Authority auth lookup error:", userError);
      return jsonResponse(401, { error: "Invalid authority session" });
    }

    const authorityName = body.authorityName.trim();
    const publicKey = {
      x: body.publicKeyX,
      y: body.publicKeyY,
    };

    const proofValid = await verifyAuthorityOwnershipProof(
      user.id,
      authorityName,
      publicKey,
      body.issuedAt,
      body.signature
    );

    if (!proofValid) {
      return jsonResponse(401, { error: "Authority key ownership proof is invalid" });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: existing, error: existingError } = await supabase
      .from("election_authorities")
      .select("id, name, auth_user_id")
      .eq("public_key_x", publicKey.x)
      .eq("public_key_y", publicKey.y)
      .maybeSingle();

    if (existingError) {
      console.error("Authority lookup error:", existingError);
      return jsonResponse(500, { error: "Failed to load authority record" });
    }

    if (existing) {
      if (existing.name === DEFAULT_AUTHORITY_NAME && existing.auth_user_id !== user.id) {
        return jsonResponse(403, {
          error:
            "The default election authority must be linked through a server-side bootstrap, not self-service signup.",
        });
      }

      if (existing.auth_user_id && existing.auth_user_id !== user.id) {
        return jsonResponse(409, { error: "This authority is already linked to another account" });
      }

      if (!existing.auth_user_id) {
        const { error: updateError } = await supabase
          .from("election_authorities")
          .update({ auth_user_id: user.id })
          .eq("id", existing.id);

        if (updateError) {
          console.error("Authority link update error:", updateError);
          return jsonResponse(500, { error: "Failed to link authority to this account" });
        }
      }

      return jsonResponse(200, {
        authorityId: existing.id,
        authorityName: existing.name,
        success: true,
      });
    }

    const { data: created, error: insertError } = await supabase
      .from("election_authorities")
      .insert({
        auth_user_id: user.id,
        description: null,
        name: authorityName,
        public_key_x: publicKey.x,
        public_key_y: publicKey.y,
      })
      .select("id, name")
      .single();

    if (insertError || !created) {
      console.error("Authority create error:", insertError);
      return jsonResponse(500, { error: "Failed to create authority record" });
    }

    return jsonResponse(200, {
      authorityId: created.id,
      authorityName: created.name,
      success: true,
    });
  } catch (error) {
    console.error("authority-link error:", error);
    return jsonResponse(500, { error: "Internal server error" });
  }
});
