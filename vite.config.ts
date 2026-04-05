
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { createRequire } from "module";
import { componentTagger } from "lovable-tagger";

const require = createRequire(import.meta.url);

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

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    allowedHosts: [
      "localhost", 
      "127.0.0.1", 
      "5b93c9f6-6030-481f-9739-d256e198148c.lovableproject.com"
    ],
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      assert: require.resolve("assert/"),
      events: require.resolve("events/"),
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2020',
    },
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
}));
