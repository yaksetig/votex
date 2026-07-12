
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { createRequire } from "module";
import { readFileSync } from "fs";

const require = createRequire(import.meta.url);

function serveIdKitWasm() {
  const wasm = readFileSync(
    path.resolve(__dirname, "node_modules/@worldcoin/idkit-core/dist/idkit_wasm_bg.wasm")
  );

  return {
    name: "serve-idkit-wasm",
    configureServer(server: { middlewares: { use: (handler: (request: { url?: string }, response: { setHeader: (name: string, value: string) => void; end: (body: Buffer) => void }, next: () => void) => void) => void } }) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split("?", 1)[0] !== "/node_modules/.vite/deps/idkit_wasm_bg.wasm") {
          next();
          return;
        }

        response.setHeader("Content-Type", "application/wasm");
        response.setHeader("Cache-Control", "no-cache");
        response.end(wasm);
      });
    },
  };
}

function isNodeModule(id: string): boolean {
  return id.includes("/node_modules/");
}

function includesAny(id: string, fragments: string[]): boolean {
  return fragments.some((fragment) => id.includes(fragment));
}

function manualChunks(id: string): string | undefined {
  if (!isNodeModule(id)) {
    return undefined;
  }

  if (
    includesAny(id, [
      "/recharts/",
      "/victory-vendor/",
      "/react-smooth/",
      "/d3-",
    ])
  ) {
    return "charts-vendor";
  }

  if (includesAny(id, ["/@worldcoin/idkit/", "/@worldcoin/idkit-core/"])) {
    return "worldid-vendor";
  }

  if (id.includes("/@supabase/")) {
    return "supabase-vendor";
  }

  if (
    includesAny(id, [
      "/@radix-ui/",
      "/@floating-ui/",
      "/cmdk/",
      "/vaul/",
      "/react-remove-scroll/",
      "/react-remove-scroll-bar/",
      "/react-style-singleton/",
      "/use-callback-ref/",
      "/use-sidecar/",
      "/class-variance-authority/",
      "/clsx/",
      "/tailwind-merge/",
      "/tailwindcss-animate/",
      "/next-themes/",
      "/input-otp/",
    ])
  ) {
    return "ui-vendor";
  }

  if (
    includesAny(id, [
      "/react-hook-form/",
      "/@hookform/resolvers/",
      "/zod/",
      "/react-day-picker/",
    ])
  ) {
    return "forms-vendor";
  }

  if (includesAny(id, ["/react-router/", "/react-router-dom/", "/@tanstack/react-query/"])) {
    return "app-vendor";
  }

  if (id.includes("/date-fns/")) {
    return "date-vendor";
  }

  if (includesAny(id, ["/react/", "/react-dom/", "/scheduler/"])) {
    return "react-vendor";
  }

  return undefined;
}

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    allowedHosts: [
      "localhost", 
      "127.0.0.1"
    ],
  },
  plugins: [serveIdKitWasm(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      assert: require.resolve("assert/"),
      events: require.resolve("events/"),
      util: require.resolve("util/"),
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2020',
    },
  },
  build: {
    target: 'es2020',
    // circomlibjs is intentionally isolated in a lazy crypto chunk. Replacing
    // it is outside the pre-production hardening scope, so the warning limit
    // reflects that reviewed, non-entry bundle rather than hiding app-shell growth.
    chunkSizeWarningLimit: 3100,
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
}));
