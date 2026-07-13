import { expect, test } from "@playwright/test";
import {
  installDeterministicPasskey,
  installVotexBackend,
} from "./support/votex-backend";

test("verified voter creates, delegates, signs, audits, nullifies, closes, and tallies", async ({ page }, testInfo) => {
  const backend = await installVotexBackend(page);
  await installDeterministicPasskey(page);

  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Create a New Votex Passkey" }).click();
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

  await page.getByRole("button", { name: "Vote", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Cast your ballot" })).toBeVisible();
  await page.getByRole("button", { name: "Unlock Passkey" }).click();
  await expect(page.getByText("Passkey unlocked", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Delegate Vote" }).click();
  await page.getByLabel(/Participant #1/).click();
  await page.getByRole("button", { name: "Delegate", exact: true }).click();
  await expect(page.getByText("Vote delegated", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Revoke Delegation" }).click();
  await expect(page.getByText("Delegation revoked", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Option A\s+Approve/ }).click();
  await page.getByRole("button", { name: "Cast vote" }).click();

  await expect(page.getByRole("heading", { name: "Public ballot receipt" })).toBeVisible();
  await expect(page.getByText("Vote cast successfully", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Verify" }).click();
  await expect(page.getByRole("heading", { name: "Verify ballot receipt" })).toBeVisible();
  await expect(page.getByText("Verified", { exact: true })).toBeVisible();

  if (testInfo.project.name === "chromium") {
    const electionId = String(backend.elections[0].id);
    await page.goto(`/elections/${electionId}`);
    await expect(page.getByRole("heading", { name: "Submit a Nullification" })).toBeVisible();
    await page.getByRole("button", { name: /Nullify Vote/ }).click();
    await page.getByRole("button", { name: /Dummy Nullification/ }).click();
    await expect(page.getByText("Dummy nullification submitted", { exact: true })).toBeVisible({
      timeout: 90_000,
    });
  }

  await page.goto("/election_authority");
  await page.getByLabel("Email").fill("authority@votex.world");
  await page.getByLabel("Password").fill("correct horse battery staple");
  await page.getByRole("button", { name: "Secure Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Election Authority Admin Panel" })).toBeVisible();
  await expect(page.getByText("E2E Community Proposal", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Manage Dashboard" }).click();

  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Close Election Early" }).click();
  await expect(page.getByText("Election closed", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Process Tally" }).click();
  await page.getByLabel("Authority secret").fill("e2e-authority-secret");
  await page.getByRole("button", { name: "Begin Tally Processing" }).click();
  await expect(page.getByText("Tally processed", { exact: true })).toBeVisible();

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
