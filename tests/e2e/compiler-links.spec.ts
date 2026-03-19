import { expect, test } from "@playwright/test";

test("runtime diagnostic opens errors pane", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("diagnostic-execution").click();
  await expect(page.getByTestId("bottom-tab-runtime")).toHaveClass(/active/);
  await expect(page.getByTestId("runtime-tab-errors")).toHaveClass(/active/);
});

test("token click highlights token row", async ({ page }) => {
  await page.goto("/");
  const tokenRow = page.getByTestId("token-item-0");
  await expect(tokenRow).toBeVisible();
  await tokenRow.click();
  await expect(tokenRow).toHaveAttribute("data-highlighted", "true");
});

test("step advances keep token highlight visible", async ({ page }) => {
  await page.goto("/");

  const nextButton = page.getByTestId("step-next");
  await expect(nextButton).toBeVisible();
  await nextButton.click();

  const highlightedToken = page.locator("[data-testid^='token-item-'][data-highlighted='true']").first();
  await expect(highlightedToken).toBeVisible();
});
