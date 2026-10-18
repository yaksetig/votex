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
  await expect(page.getByText("Ballot record", { exact: false })).toBeVisible();
  await expect(page.getByText("Nullification:", { exact: true })).toBeVisible();
  await expect(page.getByText("Delegation:", { exact: true })).toBeVisible();
});

test("authority portal uses its own authentication gateway", async ({ page }) => {
  await page.goto("/authority");
  await expect(page).toHaveURL(/\/authority$/);
  await expect(page.getByRole("heading", { name: "Sign in to continue" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
});

test("World ID onboarding links to the disclosure and audit pages", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByRole("button", { name: "Continue with passkey" })).toBeVisible();
  await expect(page.getByRole("button", { name: "I don't have a Votex passkey yet" })).toBeVisible();
  await expect(page.getByText("A new passkey creates a new voting identity", { exact: false })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
  await expect(page.getByRole("main").getByRole("link", { name: "Audit Protocol" })).toHaveAttribute("href", "/audit-protocol");
  await expect(page.getByRole("main").getByRole("link", { name: "Support" })).toHaveAttribute("href", "mailto:support@votex.world");
});
