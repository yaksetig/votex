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
