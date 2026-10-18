// Request handling for create-election, extracted so validation can be
// unit-tested with a fake supabase client.
//
// An election is created only for a server-validated World ID session and is
// always bound to the single configured Election Authority; the client cannot
// choose the creator or the authority. `showRunningTally` is a display rule
// chosen by the creator (default true) and is stored on the election row.

import { errorResponse, jsonResponse } from "../_shared/http.ts";
import { validateWorldIdSession } from "../_shared/session.ts";
import { isPlaceholderAuthorityKey, isUuid } from "../_shared/fixedAuthority.ts";
import type { SupabaseClient } from "../_shared/supabase.ts";

export const TITLE_LENGTH = { min: 3, max: 100 } as const;
export const DESCRIPTION_LENGTH = { min: 10, max: 500 } as const;
export const OPTION_LENGTH = { min: 1, max: 50 } as const;

export interface CreateElectionRequest {
  sessionToken: string;
  title: string;
  description: string;
  option1: string;
  option2: string;
  endDate: string;
  idempotencyKey: string;
  /** Show the running result while voting is open. Defaults to true. */
  showRunningTally?: boolean;
}

export interface CreateElectionDeps {
  supabase: SupabaseClient;
  fixedAuthorityId: string | undefined;
  now?: () => number;
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function handleCreateElection(
  deps: CreateElectionDeps,
  body: Partial<CreateElectionRequest>
): Promise<Response> {
  const now = deps.now ?? Date.now;
  const supabase = deps.supabase;

  const title = cleanText(body.title);
  const description = cleanText(body.description);
  const option1 = cleanText(body.option1);
  const option2 = cleanText(body.option2);
  const sessionToken = cleanText(body.sessionToken);
  const idempotencyKey = cleanText(body.idempotencyKey);
  const endDate = new Date(cleanText(body.endDate));
  const showRunningTally = body.showRunningTally === undefined ? true : body.showRunningTally;

  if (!sessionToken) {
    return errorResponse(401, "SESSION_REQUIRED", "A World ID session is required");
  }

  if (
    title.length < TITLE_LENGTH.min || title.length > TITLE_LENGTH.max ||
    description.length < DESCRIPTION_LENGTH.min || description.length > DESCRIPTION_LENGTH.max ||
    option1.length < OPTION_LENGTH.min || option1.length > OPTION_LENGTH.max ||
    option2.length < OPTION_LENGTH.min || option2.length > OPTION_LENGTH.max ||
    option1.toLocaleLowerCase() === option2.toLocaleLowerCase() ||
    Number.isNaN(endDate.getTime()) || endDate.getTime() <= now() ||
    !isUuid(idempotencyKey) ||
    typeof showRunningTally !== "boolean"
  ) {
    return errorResponse(400, "VALIDATION_ERROR", "Election fields are invalid");
  }

  const fixedAuthorityId = cleanText(deps.fixedAuthorityId);
  if (!isUuid(fixedAuthorityId)) {
    return errorResponse(503, "FIXED_AUTHORITY_UNAVAILABLE", "The fixed Election Authority is not configured");
  }

  const session = await validateWorldIdSession(supabase, sessionToken, { touchLastUsed: true });
  if (!session.valid || !session.userId) {
    const expired = session.detail?.toLowerCase().includes("expired");
    return errorResponse(
      401,
      expired ? "SESSION_EXPIRED" : "SESSION_REQUIRED",
      session.detail || "World ID session validation failed"
    );
  }

  const { data: authority, error: authorityError } = await supabase
    .from("election_authorities")
    .select("id, auth_user_id, public_key_x, public_key_y")
    .eq("id", fixedAuthorityId)
    .maybeSingle();

  if (
    authorityError ||
    !authority ||
    !authority.auth_user_id ||
    isPlaceholderAuthorityKey({ x: authority.public_key_x, y: authority.public_key_y })
  ) {
    if (authorityError) {
      console.error("Fixed authority lookup failed", authorityError.code);
    }
    return errorResponse(503, "FIXED_AUTHORITY_UNAVAILABLE", "The fixed Election Authority is not ready");
  }

  const { data: matchingAuthorities, error: duplicateError } = await supabase
    .from("election_authorities")
    .select("id")
    .eq("public_key_x", authority.public_key_x)
    .eq("public_key_y", authority.public_key_y);
  if (duplicateError || matchingAuthorities?.length !== 1) {
    return errorResponse(503, "FIXED_AUTHORITY_UNAVAILABLE", "The fixed Election Authority configuration is ambiguous");
  }

  const { data: election, error: createError } = await supabase.rpc("create_election_atomic", {
    p_creator: session.userId,
    p_authority_id: authority.id,
    p_title: title,
    p_description: description,
    p_option1: option1,
    p_option2: option2,
    p_end_date: endDate.toISOString(),
    p_idempotency_key: idempotencyKey,
    p_show_running_tally: showRunningTally,
  });

  if (createError || !election) {
    console.error("Atomic election creation failed", createError?.code);
    return errorResponse(
      500,
      createError?.message === "FIXED_AUTHORITY_UNAVAILABLE" ? "FIXED_AUTHORITY_UNAVAILABLE" : "CONFLICT",
      "The election could not be created"
    );
  }

  return jsonResponse(200, { authorityId: authority.id, election });
}
