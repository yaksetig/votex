import { expect, test } from "@playwright/test";

test("privacy disclosure accurately describes public pseudonymous ballots", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Privacy model" })).toBeVisible();
  await expect(page.getByText("Ballots are intentionally public", { exact: false })).toBeVisible();
  await expect(page.getByText("Pseudonymous activity may be linkable", { exact: false })).toBeVisible();
});

test("audit protocol is a real route", async ({ page }) => {
  await page.goto("/audit-protocol");
  await expect(page.getByRole("heading", { name: "Audit protocol" })).toBeVisible();
  await expect(page.getByText("Ballot ledger", { exact: false })).toBeVisible();
  await expect(page.getByText("3. Nullification:", { exact: true })).toBeVisible();
  await expect(page.getByText("4. Delegation:", { exact: true })).toBeVisible();
});

test("authority portal uses its own authentication gateway", async ({ page }) => {
  await page.goto("/election_authority");
  await expect(page).toHaveURL(/\/election_authority$/);
  await expect(page.getByRole("heading", { name: "Sign in to continue" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
});

test("World ID onboarding links to the disclosure and audit pages", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
  await expect(page.getByRole("link", { name: "Audit Protocol" })).toHaveAttribute("href", "/audit-protocol");
  await expect(page.getByRole("link", { name: "Support" })).toHaveAttribute("href", "mailto:support@votex.world");
});
