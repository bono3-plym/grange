import { expect, test, type Page } from "@playwright/test";
import { register, resetServer, uniqueName } from "./helpers";

async function clickTile(page: Page, col: number, row: number) {
	const canvas = page.locator(".farm-map-canvas");
	const box = await canvas.boundingBox();
	expect(box).not.toBeNull();
	const x = box!.x + ((col + 0.5) / 18) * box!.width;
	const y = box!.y + ((row + 0.5) / 12) * box!.height;
	await page.mouse.click(x, y);
}

test("farming loop: hoe, seed, bucket, grow, scythe", async ({ page }) => {
	await resetServer();
	await register(page, uniqueName("Sprout"));
	await expect(page).toHaveURL(/\/world$/);
	await expect(page.getByTestId("farm-hud")).toBeVisible();
	await expect(page.getByTestId("tool-hoe")).toHaveAttribute("aria-pressed", "true");

	// Hoe tile (9, 7)
	await clickTile(page, 9, 7);
	await expect(page.getByTestId("farm-tile")).toContainText("(9, 7): tilled");

	// Seeds
	await page.keyboard.press("2");
	await expect(page.getByTestId("tool-seed")).toHaveAttribute("aria-pressed", "true");
	await clickTile(page, 9, 7);
	await expect(page.getByTestId("farm-tile")).toContainText("(9, 7): planted");

	// Bucket
	await page.keyboard.press("3");
	await clickTile(page, 9, 7);
	await expect(page.getByTestId("farm-tile")).toContainText("(9, 7): watered");

	// Wait for 10s growth, then harvest
	await expect(page.getByTestId("farm-tile")).toContainText("(9, 7): ready", {
		timeout: 20_000,
	});
	await page.keyboard.press("4");
	await clickTile(page, 9, 7);
	await expect(page.getByTestId("farm-tomatoes")).toContainText("3");
	await expect(page.getByTestId("farm-tile")).toContainText("(9, 7): tilled");

	// Drag-paint tills two tiles at once
	await page.keyboard.press("1");
	const canvas = page.locator(".farm-map-canvas");
	const box = await canvas.boundingBox();
	const px = (c: number) => box!.x + ((c + 0.5) / 18) * box!.width;
	const py = (r: number) => box!.y + ((r + 0.5) / 12) * box!.height;
	await page.mouse.move(px(7), py(6));
	await page.mouse.down();
	await page.mouse.move(px(8), py(6), { steps: 5 });
	await page.mouse.up();
	await expect(page.getByTestId("farm-tile")).toContainText("(8, 6): tilled");
});

test("the hoe refuses fence tiles", async ({ page }) => {
	await resetServer();
	await register(page, uniqueName("Sprout"));
	await expect(page).toHaveURL(/\/world$/);
	await expect(page.getByTestId("farm-hud")).toBeVisible();

	await clickTile(page, 7, 5);
	await expect(page.getByTestId("farm-hint")).toContainText(
		"Something is in the way.",
	);
	await expect(page.getByTestId("farm-tile")).toContainText("(7, 5): grass");
});

test("the hoe refuses tiles behind buildings", async ({ page }) => {
	await resetServer();
	await register(page, uniqueName("Sprout"));
	await expect(page).toHaveURL(/\/world$/);
	await expect(page.getByTestId("farm-hud")).toBeVisible();

	await clickTile(page, 3, 2);
	await expect(page.getByTestId("farm-hint")).toContainText(
		"Something is in the way.",
	);
	await expect(page.getByTestId("farm-tile")).toContainText("(3, 2): grass");
});

test("tilling under flowers clears them", async ({ page }) => {
	await resetServer();
	await register(page, uniqueName("Sprout"));
	await expect(page).toHaveURL(/\/world$/);
	await expect(page.getByTestId("farm-hud")).toBeVisible();

	await clickTile(page, 11, 3);
	await expect(page.getByTestId("farm-tile")).toContainText("(11, 3): tilled");
});

test("hoeing and planting a tile round-trips through the server", async ({
	page,
}) => {
	await resetServer();
	await register(page, uniqueName("Farmer"));

	const canvas = page.locator("canvas[aria-label^='Farm map']");
	await expect(canvas).toBeVisible();

	const tiles = page.getByTestId("farm-map-tiles");
	await expect(tiles).toHaveText("0 tiles");

	// The player spawns on a farmable tile, so the selected tool acts immediately.
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
	await expect(page.getByTestId("tool-bucket")).toHaveClass(/farm-tool-active/);
	await expect(page.getByTestId("tool-hoe")).not.toHaveClass(/farm-tool-active/);
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
