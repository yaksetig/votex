// Shared CORS headers for all edge functions. Set the ALLOWED_ORIGIN secret
// to the app origin in production; defaults to * for local development.
const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") ?? "*";

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  ...(allowedOrigin !== "*" ? { Vary: "Origin" } : {}),
};
