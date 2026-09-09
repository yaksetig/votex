import { randomBytes } from "node:crypto";

const secret = `votex-auth-v1_${randomBytes(32).toString("hex")}`;

process.stdout.write(
  [
    "Generated Votex authority recovery key.",
    "Store it in a password manager now; it cannot be recovered later.",
    "",
    secret,
    "",
  ].join("\n")
);
