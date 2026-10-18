import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { installDeterministicPasskey, installVotexBackend } from "./support/votex-backend";

/**
 * Automated accessibility gate. Every key surface is scanned with axe-core
 * (WCAG 2.0/2.1 A + AA) and must report no critical or serious violations.
 *
 * `KNOWN` lists rule ids that are still being fixed on a given surface; the
 * remediation plan (docs/UX_REMEDIATION_PLAN.md) empties it phase by phase.
 * Add to it only with a UX id and remove entries as soon as they pass.
 */
const KNOWN: Record<string, string[]> = {
  // UX-046 / UX-119: dimmed step text and text-outline labels (Phases C, J)
  "/sign-in": ["color-contrast"],
  "sign-in complete": ["color-contrast"],
  // UX-059: the Sort label is display:none below sm (Phase D)
  "/elections": ["select-name"],
  // UX-053 deadline input has no label; UX-059 sort label (Phase D)
  "create election form": ["label", "select-name"],
  // UX-119: outline-toned submit button text (Phase H)
  "authority sign-in": ["color-contrast"],
};

type Findings = string[];

/** Scans the page and appends blocking violations to `findings`; asserted once per test. */
async function scan(page: Page, surface: string, findings: Findings) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const allowed = new Set(KNOWN[surface] ?? []);
  for (const violation of results.violations) {
    if (violation.impact !== "critical" && violation.impact !== "serious") continue;
    if (allowed.has(violation.id)) continue;
    const targets = violation.nodes.slice(0, 3).map((node) => node.target.join(" ")).join(" | ");
    findings.push(`[${surface}] ${violation.id} (${violation.impact}): ${targets}`);
  }
}

test.describe("accessibility", () => {
  test("public pages", async ({ page }) => {
    await installVotexBackend(page);
    const findings: Findings = [];
    for (const path of ["/", "/elections", "/how-it-works", "/faq", "/privacy", "/audit-protocol", "/missing-page"]) {
      await page.goto(path);
      await page.getByRole("main").waitFor();
      await scan(page, path, findings);
    }
    expect(findings).toEqual([]);
  });

  test("voter journey surfaces", async ({ page }) => {
    const backend = await installVotexBackend(page);
    await installDeterministicPasskey(page);
    const findings: Findings = [];

    await page.goto("/sign-in");
    await scan(page, "/sign-in", findings);

    await page.getByRole("button", { name: "Create a New Votex Passkey" }).click();
    await page.getByRole("button", { name: "Complete test World ID verification" }).click();
    await expect(page.getByRole("heading", { name: "Identity Confirmed" })).toBeVisible();
    await scan(page, "sign-in complete", findings);

    await page.goto("/elections");
    await page.getByRole("button", { name: "Create Election" }).click();
    await scan(page, "create election form", findings);

    await page.getByLabel("Election title").fill("Accessibility Check Election");
    await page.getByLabel("Context").fill("A long enough description for the accessibility scan of the detail page.");
    await page.getByLabel("Option A").fill("Approve");
    await page.getByLabel("Option B").fill("Decline");
    await page.locator("#endDate").fill("2030-07-13T12:00");
    await page.getByRole("button", { name: "Publish Election" }).click();
    await expect(page.getByRole("heading", { name: "Accessibility Check Election" })).toBeVisible();

    const electionId = String(backend.elections[0].id);
    await page.goto(`/elections/${electionId}`);
    await scan(page, "election detail", findings);
    expect(findings).toEqual([]);
  });

  test("authority surfaces", async ({ page }) => {
    await installVotexBackend(page);
    const findings: Findings = [];
    await page.goto("/authority");
    await scan(page, "authority sign-in", findings);

    await page.getByLabel("Email").fill("authority@votex.world");
    await page.getByLabel("Password").fill("correct horse battery staple");
    await page.getByRole("button", { name: "Secure Sign In" }).click();
    await expect(page.getByRole("heading", { name: "Election Authority Admin Panel" })).toBeVisible();
    await scan(page, "authority elections", findings);
    expect(findings).toEqual([]);
  });
});
