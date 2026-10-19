import { expect, test } from "@playwright/test";
import {
  installDeterministicPasskey,
  installVotexBackend,
} from "./support/votex-backend";

test("verified voter creates, delegates, signs, audits, nullifies, closes, and tallies", async ({ page }, testInfo) => {
  const backend = await installVotexBackend(page);
  await installDeterministicPasskey(page);

  await page.goto("/sign-in");
  await page.getByRole("button", { name: "I don't have a Votex passkey yet" }).click();
  await page.getByRole("button", { name: "Complete test World ID verification" }).click();
  await expect(page.getByRole("heading", { name: "Identity Confirmed" })).toBeVisible();
  await page.getByRole("button", { name: "Continue to Elections" }).click();

  await page.getByRole("button", { name: "Create Election" }).click();
  await page.getByLabel("Election title").fill("E2E Community Proposal");
  await page.getByLabel("Context").fill("A deterministic full-lifecycle election for release validation.");
  await page.getByLabel("Option A").fill("Approve");
  await page.getByLabel("Option B").fill("Reject");
  await page.locator("#endDate").fill("2030-07-13T12:00");
  await page.getByRole("button", { name: "Publish Election" }).click();
  await expect(page.getByText("Election published", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "E2E Community Proposal" })).toBeVisible();

  // Publishing lands on the new election's page.
  await expect(page.getByRole("heading", { name: "Cast your ballot" })).toBeVisible();
  await page.getByRole("button", { name: "Unlock passkey" }).click();
  await expect(page.getByRole("button", { name: "Unlock passkey" })).toBeHidden();
  await page.getByRole("button", { name: "Delegate ballot" }).click();
  await page.getByLabel(/e2e-delegate-pseudonym/).click();
  await page.getByRole("button", { name: "Delegate", exact: true }).click();
  await expect(page.getByText("You have delegated your ballot", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Revoke delegation" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Revoke delegation" }).click();
  await expect(page.getByRole("button", { name: "Delegate ballot" })).toBeVisible();
  await page.getByRole("radio", { name: /Option A\s+Approve/ }).click();
  await page.getByRole("button", { name: "Cast vote" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Publish ballot" }).click();

  await expect(page.getByRole("heading", { name: "Public ballot receipt" })).toBeVisible();
  await expect(page.getByText("Ballot recorded", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Open receipt page" }).click();
  await expect(page.getByRole("heading", { name: "Verify ballot receipt" })).toBeVisible();
  await expect(page.getByText("Verified", { exact: true })).toBeVisible();

  if (testInfo.project.name === "chromium") {
    const electionId = String(backend.elections[0].id);
    await page.goto(`/elections/${electionId}`);
    await expect(page.getByRole("heading", { name: "Nullification" })).toBeVisible();
    await page.getByRole("button", { name: "Submit nullification request" }).click();
    await page.getByRole("button", { name: /Send a decoy/ }).click();
    await expect(page.getByText("Nullification request submitted", { exact: true })).toBeVisible({
      timeout: 90_000,
    });
  }

  await page.goto("/authority");
  await page.getByLabel("Email").fill("authority@votex.world");
  await page.getByLabel("Password").fill("correct horse battery staple");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Elections", exact: true })).toBeVisible();
  // The list renders cards on narrow screens and a table otherwise; one is visible.
  await expect(page.getByText("E2E Community Proposal", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Open E2E Community Proposal" }).click();

  await page.getByRole("button", { name: "Close election early" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Close election now" }).click();
  await expect(page.getByText("Election closed", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Run tally" }).click();
  await page.getByLabel("Authority secret").fill(`votex-auth-v1_${"2".repeat(64)}`);
  await page.getByRole("button", { name: "Run tally" }).click();
  await expect(page.getByText("Tally processed", { exact: true })).toBeVisible();

  const electionId = String(backend.elections[0].id);
  await page.goto(`/elections/${electionId}`);
  await page.getByRole("tab", { name: "Audit Trail" }).click();
  await expect(page.getByText("CLOSE_ELECTION", { exact: true })).toBeVisible();
  await expect(page.getByText("Delegation revoked", { exact: true })).toBeVisible();

  expect(backend.elections).toHaveLength(1);
  expect(backend.participants).toHaveLength(6);
  expect(backend.votes).toHaveLength(1);
  expect(backend.yesVotes).toHaveLength(1);
  expect(backend.noVotes).toHaveLength(0);
  expect(backend.delegations).toHaveLength(1);
  expect(backend.delegations[0].status).toBe("revoked");
  expect(backend.nullifications).toHaveLength(testInfo.project.name === "chromium" ? 6 : 0);
  expect(backend.tallies).toHaveLength(1);
  expect(backend.unexpectedRequests).toEqual([]);
});
