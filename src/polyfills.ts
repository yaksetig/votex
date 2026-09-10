import { Buffer } from "buffer";

const globalScope = globalThis as typeof globalThis & {
  Buffer?: typeof Buffer;
  global?: typeof globalThis;
};

if (!globalScope.Buffer) {
  globalScope.Buffer = Buffer;
}

if (!globalScope.global) {
  globalScope.global = globalThis;
}

// Node globals shim: some deps (circomlibjs -> util/assert) reference
// `process`, which does not exist in the browser. Lives here (imported first
// by main.tsx) rather than as an inline <script> in index.html so the page can
// ship a Content-Security-Policy without 'unsafe-inline'.
const globalWithProcess = globalThis as unknown as { process?: unknown };
if (!globalWithProcess.process) {
  globalWithProcess.process = {
    env: {},
    versions: {},
    platform: "browser",
    nextTick: (callback: () => void) => {
      void Promise.resolve().then(callback);
    },
  };
}
