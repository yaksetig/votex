import { corsHeaders } from "../_shared/cors.ts";
import { createServiceRoleClient } from "../_shared/supabase.ts";
import { errorResponse, jsonResponse } from "../_shared/http.ts";
import { isPlaceholderAuthorityKey } from "../_shared/fixedAuthority.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "POST") {
    return errorResponse(405, "METHOD_NOT_ALLOWED", "Method not allowed");
  }

  const fixedAuthorityId = Deno.env.get("FIXED_AUTHORITY_ID")?.trim();
  if (!fixedAuthorityId) {
    return jsonResponse(200, { configured: false, linked: false });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("election_authorities")
    .select("id, name, auth_user_id, public_key_x, public_key_y")
    .eq("id", fixedAuthorityId)
    .maybeSingle();

  if (error || !data) {
    return jsonResponse(200, { configured: false, linked: false });
  }

  const placeholder = isPlaceholderAuthorityKey({
    x: data.public_key_x,
    y: data.public_key_y,
  });

  return jsonResponse(200, {
    configured: !placeholder,
    linked: !placeholder && Boolean(data.auth_user_id),
    authorityName: data.name,
  });
});
