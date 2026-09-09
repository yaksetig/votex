import { readFile, writeFile } from "node:fs/promises";

const [inputPath, outputPath] = process.argv.slice(2);

if (!inputPath || !outputPath) {
  throw new Error(
    "Usage: node scripts/generate-verification-key-module.mjs <verification-key.json> <output.ts>"
  );
}

const verificationKey = JSON.parse(await readFile(inputPath, "utf8"));
if (
  verificationKey.protocol !== "groth16" ||
  verificationKey.curve !== "bn128" ||
  verificationKey.nPublic !== 17
) {
  throw new Error("Unexpected XOR nullification verification-key shape");
}

const source = `// Generated from ${inputPath}; do not edit by hand.\nexport const verificationKeyXor = ${JSON.stringify(
  verificationKey,
  null,
  2
)};\n`;

await writeFile(outputPath, source, "utf8");
