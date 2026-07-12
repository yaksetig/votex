import { spawnSync } from "node:child_process";

const acceptedAdvisories = new Set([
  "GHSA-848j-6mx2-7j84",
  "GHSA-58qx-3vcg-4xpx",
  "GHSA-96hv-2xvq-fx4p",
]);

const audit = spawnSync(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["audit", "--omit=dev", "--json"],
  { encoding: "utf8" }
);

if (!audit.stdout) {
  process.stderr.write(audit.stderr || "npm audit returned no JSON output\n");
  process.exit(1);
}

const report = JSON.parse(audit.stdout);
const unexpected = [];

for (const [name, vulnerability] of Object.entries(report.vulnerabilities ?? {})) {
  if (!['high', 'critical'].includes(vulnerability.severity)) continue;
  const advisoryIds = (vulnerability.via ?? [])
    .filter((entry) => typeof entry === "object" && entry.url)
    .map((entry) => entry.url.split("/").at(-1));
  const isAcceptedChain = advisoryIds.length === 0
    ? (vulnerability.via ?? []).every((entry) => typeof entry === "string")
    : advisoryIds.every((id) => acceptedAdvisories.has(id));
  if (!isAcceptedChain) unexpected.push({ name, severity: vulnerability.severity, advisoryIds });
}

if (unexpected.length > 0) {
  process.stderr.write(`Unexpected high/critical production advisories:\n${JSON.stringify(unexpected, null, 2)}\n`);
  process.exit(1);
}

process.stdout.write("No unaccepted high or critical production advisories.\n");
