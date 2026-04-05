import { supabase } from "@/integrations/supabase/client";

const SESSION_STORAGE_KEY = "votex:worldid:session";
const SESSION_VERIFIER_DOMAIN = new TextEncoder().encode("votex:session:v1");

interface StoredSession {
  token: string;
  expiresAt: string;
}

interface CreateSessionResponse {
  sessionToken: string;
  expiresAt: string;
  userId: string;
}

interface ValidateSessionResponse {
  valid: boolean;
  expiresAt?: string;
  userId?: string;
}

export interface ActiveWorldIdSession {
  expiresAt: string;
  userId: string;
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getStoredSession(): StoredSession | null {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export function getStoredWorldIdSessionToken(): string | null {
  return getStoredSession()?.token ?? null;
}

function storeSession(session: StoredSession): void {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredWorldIdSession(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

export async function deriveSessionVerifierHash(
  prfSecret: ArrayBuffer
): Promise<string> {
  const secretBytes = new Uint8Array(prfSecret);
  const combined = new Uint8Array(
    secretBytes.length + SESSION_VERIFIER_DOMAIN.length
  );

  combined.set(secretBytes, 0);
  combined.set(SESSION_VERIFIER_DOMAIN, secretBytes.length);

  const digest = await crypto.subtle.digest("SHA-256", combined);
  return bufferToHex(digest);
}

export async function createWorldIdSession(
  nullifierHash: string,
  prfSecret: ArrayBuffer,
  bootstrapVerifier: boolean
): Promise<ActiveWorldIdSession> {
  const verifierHash = await deriveSessionVerifierHash(prfSecret);

  const { data, error } = await supabase.functions.invoke("worldid-session", {
    body: {
      action: "create",
      bootstrapVerifier,
      nullifierHash,
      verifierHash,
    },
  });

  if (error) {
    throw new Error(error.message || "Failed to create voter session");
  }

  const session = data as CreateSessionResponse | undefined;
  if (!session?.sessionToken || !session?.userId || !session?.expiresAt) {
    throw new Error("Session response was incomplete");
  }

  storeSession({
    token: session.sessionToken,
    expiresAt: session.expiresAt,
  });

  return {
    expiresAt: session.expiresAt,
    userId: session.userId,
  };
}

export async function validateStoredWorldIdSession(): Promise<ActiveWorldIdSession | null> {
  const storedSession = getStoredSession();
  if (!storedSession?.token) {
    return null;
  }

  const { data, error } = await supabase.functions.invoke("worldid-session", {
    body: {
      action: "validate",
      sessionToken: storedSession.token,
    },
  });

  if (error) {
    clearStoredWorldIdSession();
    return null;
  }

  const validation = data as ValidateSessionResponse | undefined;
  if (!validation?.valid || !validation.userId || !validation.expiresAt) {
    clearStoredWorldIdSession();
    return null;
  }

  storeSession({
    token: storedSession.token,
    expiresAt: validation.expiresAt,
  });

  return {
    expiresAt: validation.expiresAt,
    userId: validation.userId,
  };
}

export async function revokeStoredWorldIdSession(): Promise<void> {
  const storedSession = getStoredSession();

  if (storedSession?.token) {
    try {
      await supabase.functions.invoke("worldid-session", {
        body: {
          action: "revoke",
          sessionToken: storedSession.token,
        },
      });
    } catch {
      // Best-effort revocation; local cleanup still happens below.
    }
  }

  clearStoredWorldIdSession();
}
