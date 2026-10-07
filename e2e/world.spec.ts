import { expect, test } from "@playwright/test";
import { register, resetServer, uniqueName } from "./helpers";

test("farm world loads without asset or page errors", async ({ page }) => {
	const pageErrors: string[] = [];
	const failedAssets: string[] = [];

	page.on("pageerror", (error) => {
		pageErrors.push(error.message);
	});

	page.on("response", (response) => {
		if (
			/\/assets\/(farm|marketplace|transport)\//.test(response.url()) &&
			!response.ok()
		) {
			failedAssets.push(response.url());
		}
	});

	await resetServer();
	await register(page, uniqueName("Sprout"));

	const canvas = page.locator("canvas[aria-label^='Farm map']");
	await expect(canvas).toBeVisible();

	await page.waitForLoadState("networkidle");

	expect(pageErrors).toEqual([]);
	expect(failedAssets).toEqual([]);
});

test("the train travels between the farm and marketplace", async ({ page }) => {
	await resetServer();
	await register(page, uniqueName("Traveler"));

	const canvas = page.locator("canvas");
	await expect(canvas).toHaveAttribute("aria-label", /^Farm map/);
	await page.waitForLoadState("networkidle");

	await page.keyboard.down("d");
	await page.waitForTimeout(1_000);
	await page.keyboard.up("d");

	const prompt = page.getByTestId("travel-prompt");
	await expect(prompt).toContainText("travel to the marketplace");
	await page.keyboard.press("e");

	await expect(canvas).toHaveAttribute("aria-label", /^Marketplace map/);
	await expect(prompt).toContainText("return to the farm");
	await page.keyboard.press("e");
	await expect(canvas).toHaveAttribute("aria-label", /^Farm map/);
});

test("the marketplace casino opens and returns outside", async ({ page }) => {
	await resetServer();
	await register(page, uniqueName("Highroller"));

	const canvas = page.locator("canvas");
	const prompt = page.getByTestId("travel-prompt");
	await page.waitForLoadState("networkidle");
	await page.keyboard.down("d");
	await page.waitForTimeout(1_000);
	await page.keyboard.up("d");
	await expect(prompt).toContainText("travel to the marketplace");
	await page.keyboard.press("e");
	await expect(canvas).toHaveAttribute("aria-label", /^Marketplace map/);

	await page.keyboard.down("w");
	await page.keyboard.down("d");
	await page.waitForTimeout(2_900);
	await page.keyboard.up("w");
	await page.keyboard.up("d");
	await page.keyboard.down("d");
	await page.waitForTimeout(1_200);
	await page.keyboard.up("d");

	await expect(prompt).toContainText("enter the casino");
	await page.keyboard.press("e");
	await expect(canvas).toHaveAttribute("aria-label", /^Casino map/);
	await expect(prompt).toContainText("leave the casino");

	await page.keyboard.press("e");
	await expect(canvas).toHaveAttribute("aria-label", /^Marketplace map/);
});

test("the farm map is closed to visitors without a session", async ({ page }) => {
	await resetServer();
	await page.goto("/world");

	await expect(page).toHaveURL("/");
	await expect(
		page.locator("canvas[aria-label^='Farm map']"),
	).toHaveCount(0);
});

test("farm world shows the starting balance HUD", async ({ page }) => {
	await resetServer();
	await register(page, uniqueName("Sprout"));

	const balance = page.getByTestId("farm-balance");
	await expect(balance).toBeVisible();
	await expect(balance).toContainText("100");
});
