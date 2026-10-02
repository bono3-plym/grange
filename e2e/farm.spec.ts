import { expect, test } from "@playwright/test";
import { register, resetServer, uniqueName } from "./helpers";

test("hoeing and planting a tile round-trips through the server", async ({
	page,
}) => {
	await resetServer();
	await register(page, uniqueName("Farmer"));

	const canvas = page.locator("canvas[aria-label^='Farm map']");
	await expect(canvas).toBeVisible();

	const tiles = page.getByTestId("farm-map-tiles");
	await expect(tiles).toHaveText("0 tiles");

	// The player spawns on a field tile, so the selected tool acts immediately.
	await page.getByTestId("tool-hoe").click();
	await page.keyboard.press("Space");
	await expect(tiles).toHaveText("1 tiles");

	await page.getByTestId("tool-seed").click();
	await page.keyboard.press("Space");
	await expect(tiles).toHaveText("1 tiles");
});

test("the tool bar highlights the selected tool", async ({ page }) => {
	await resetServer();
	await register(page, uniqueName("Farmer"));

	await page.getByTestId("tool-bucket").click();
	await expect(page.getByTestId("tool-bucket")).toHaveClass(/farm-map-tool-active/);
	await expect(page.getByTestId("tool-hoe")).not.toHaveClass(
		/farm-map-tool-active/,
	);
});

test("a visitor sees another farm read-only", async ({ page }) => {
	await resetServer();
	const owner = uniqueName("Owner");
	await register(page, owner);
	await page.getByTestId("logout").click();
	await page.waitForURL("**/");

	await register(page, uniqueName("Visitor"));
	await page.goto(`/farms/${encodeURIComponent(owner)}`);

	await expect(page.locator("canvas[aria-label^='Farm map']")).toBeVisible();
	await expect(page.getByTestId("tool-hoe")).toHaveCount(0);
});
