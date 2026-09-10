// Supabase client construction shared by every edge function.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.3";

// deno-lint-ignore no-explicit-any
export type SupabaseClient = any;

/** Service-role client: bypasses RLS, used only after the caller is authorised. */
export function createServiceRoleClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

export interface AuthenticatedUser {
  id: string;
}

/**
 * Resolve the Supabase Auth user behind a request's Authorization header by
 * asking Auth to validate the JWT (never by trusting a body field). Returns
 * null when the header is missing or the token is invalid.
 */
export async function getAuthenticatedUser(req: Request): Promise<AuthenticatedUser | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return null;
  }
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const {
    data: { user },
    error,
  } = await userClient.auth.getUser();
  if (error || !user) {
    console.error("Auth user lookup error:", error);
    return null;
  }
  return { id: user.id };
}
