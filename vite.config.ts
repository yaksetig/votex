
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { nodePolyfills } from 'vite-plugin-node-polyfills';

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
    nodePolyfills({
      include: ['buffer', 'crypto']
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2020',
    },
  },
  build: {
    target: 'es2020',
  },
}));
