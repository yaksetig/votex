import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    // Only run the browser/node test suite. Edge-function tests under
    // supabase/functions use Deno + https: imports and run via `deno test`.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    environmentOptions: {
      jsdom: {
        url: "http://localhost:8080",
      },
    },
    env: {
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_ANON_KEY: "test-anon-key",
    },
  },
});
