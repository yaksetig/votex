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
};

type Findings = string[];

/** Scans the page and appends blocking violations to `findings`; asserted once per test. */
async function scan(page: Page, surface: string, findings: Findings) {
  // Let colour transitions finish; axe samples computed colours mid-transition otherwise.
  await page.waitForTimeout(350);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const allowed = new Set(KNOWN[surface] ?? []);
  for (const violation of results.violations) {
    if (violation.impact !== "critical" && violation.impact !== "serious") continue;
    if (allowed.has(violation.id)) continue;
    const targets = violation.nodes
      .slice(0, 3)
      .map((node) => `${node.target.join(" ")} — ${node.failureSummary?.split("\n").slice(1, 2).join("") ?? ""}`)
      .join(" | ");
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

    await page.getByRole("button", { name: "I don't have a Votex passkey yet" }).click();
    await page.getByRole("button", { name: "Complete test World ID verification" }).click();
    await expect(page.getByRole("heading", { name: "Identity confirmed" })).toBeVisible();
    await scan(page, "sign-in complete", findings);

    await page.goto("/elections");
    await page.getByRole("button", { name: "Create election" }).click();
    await expect(page.getByRole("heading", { name: "Create an election" })).toBeVisible();
    await scan(page, "create election form", findings);

    await page.getByLabel("Election title").fill("Accessibility Check Election");
    await page.getByLabel("Context").fill("A long enough description for the accessibility scan of the detail page.");
    await page.getByLabel("Option A").fill("Approve");
    await page.getByLabel("Option B").fill("Decline");
    await page.locator("#endDate").fill("2030-07-13T12:00");
    await page.getByRole("button", { name: "Publish election" }).click();
    await expect(page.getByRole("heading", { name: "Accessibility Check Election" })).toBeVisible();

    const electionId = String(backend.elections[0].id);
    await page.goto(`/elections/${electionId}`);
    await scan(page, "election detail", findings);
    expect(findings).toEqual([]);
  });

  test("authority surfaces", async ({ page }) => {
    const backend = await installVotexBackend(page);
    backend.elections.push({
      id: "22222222-2222-4222-8222-222222222222",
      title: "Accessibility Check Election",
      description: "Seeded directly so the authority dashboard has an election to open.",
      option1: "Approve",
      option2: "Decline",
      end_date: "2030-07-13T12:00:00.000Z",
      show_running_tally: true,
      created_at: new Date().toISOString(),
      creator: "e2e-voter-pseudonym",
      authority_id: "11111111-1111-4111-8111-111111111111",
      status: "active",
      closed_manually_at: null,
      last_modified_at: null,
      last_modified_by: null,
    });
    const findings: Findings = [];
    await page.goto("/authority");
    await scan(page, "authority sign-in", findings);

    await page.getByLabel("Email").fill("authority@votex.world");
    await page.getByLabel("Password").fill("correct horse battery staple");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Elections", exact: true })).toBeVisible();
    await scan(page, "authority elections", findings);

    await page.getByRole("button", { name: "Open Accessibility Check Election" }).click();
    await expect(page.getByRole("heading", { name: "Accessibility Check Election" })).toBeVisible();
    await scan(page, "authority dashboard", findings);
    await page.getByRole("tab", { name: "Run tally" }).click();
    await scan(page, "authority tally tab", findings);
    expect(findings).toEqual([]);
  });
});
