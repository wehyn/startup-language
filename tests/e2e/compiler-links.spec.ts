import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const parserFixture = readFileSync(resolve(process.cwd(), "tests/e2e/fixtures/parser-error.startup"), "utf-8");
const semanticFixture = readFileSync(resolve(process.cwd(), "tests/e2e/fixtures/semantic-error.startup"), "utf-8");
const timelineFixture = readFileSync(resolve(process.cwd(), "tests/e2e/fixtures/timeline-ok.startup"), "utf-8");

const appUrlWithSource = (source: string) => `/?source=${encodeURIComponent(source)}`;

test("runtime diagnostic opens errors pane", async ({ page }) => {
  await page.goto(appUrlWithSource(parserFixture));
  await page.getByTestId("diagnostic-execution").click();
  await expect(page.getByTestId("bottom-tab-runtime")).toHaveClass(/active/);
  await expect(page.getByTestId("runtime-tab-errors")).toHaveClass(/active/);
});

test("token click highlights token row", async ({ page }) => {
  await page.goto(appUrlWithSource(semanticFixture));
  await page.getByTestId("bottom-tab-tokens").click();
  const tokenRow = page.getByTestId("token-item-0");
  await expect(tokenRow).toBeVisible();
  await tokenRow.click();
  await expect(tokenRow).toHaveAttribute("data-highlighted", "true");
});

test("step advances keep token highlight visible", async ({ page }) => {
  await page.goto(appUrlWithSource(timelineFixture));

  const nextButton = page.getByTestId("step-next");
  await expect(nextButton).toBeVisible();
  await nextButton.click();
  await page.getByTestId("bottom-tab-tokens").click();

  const highlightedToken = page.locator("[data-testid^='token-item-'][data-highlighted='true']").first();
  await expect(highlightedToken).toBeVisible();
});

test("parser fixture shows parser diagnostic count", async ({ page }) => {
  await page.goto(appUrlWithSource(parserFixture));
  await expect(page.getByTestId("diagnostic-ast")).toContainText("0");
});

test("semantic fixture shows semantic issue in state panel", async ({ page }) => {
  await page.goto(appUrlWithSource(semanticFixture));
  await expect(page.getByTestId("diagnostic-semantic")).toContainText("1");
  await page.getByTestId("diagnostic-semantic").click();
  await page.getByRole("button", { name: "Type Check" }).click();
  await expect(page.getByTestId("type-issue-1-1")).toBeVisible();
});
