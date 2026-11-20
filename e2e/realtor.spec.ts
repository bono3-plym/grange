import { expect, test } from "@playwright/test";
import {
	BASE,
	clickWorld,
	registerFast,
	uniqueName,
	useDoor,
	waitForWorld,
	walkToHardwareStore,
	walkToRealtor,
	worldUrl,
} from "./helpers";

test("hardware store sells stackable building materials", async ({ page }) => {
	const name = uniqueName("mason");
	await registerFast(page, name, { area: "marketplace" });
	await walkToHardwareStore(page);
	await useDoor(page);

	await expect(page.getByTestId("market-window")).toBeVisible();
	await expect(page.getByTestId("market-item-wood-plank")).toBeVisible();
	await expect(page.getByTestId("market-action-wood-plank")).toBeEnabled();

	// The quantity field lets a player buy the brewery-sized bundle at once.
	await page.getByTestId("market-quantity-wood-plank").fill("5");
	await page.getByTestId("market-action-wood-plank").click();
	await expect(page.getByTestId("market-owned-wood-plank")).toContainText("5");
	await expect(page.getByTestId("farm-balance")).toContainText("0");
});

test("realtor lists the brewery with its build requirements", async ({ page }) => {
	const name = uniqueName("buyer");
	await registerFast(page, name, { area: "marketplace" });
	await walkToRealtor(page);
	await useDoor(page);

	await expect(page.getByTestId("realtor-window")).toBeVisible();
	await expect(page.getByTestId("realtor-require-wood-plank")).toContainText(
		"0/20",
	);
	await expect(page.getByTestId("realtor-require-stone")).toContainText("0/20");
	await expect(page.getByTestId("realtor-require-nails")).toContainText(
		"0/100",
	);
	await expect(page.getByTestId("realtor-require-coin")).toContainText(
		"100/5,000",
	);
	await expect(page.getByTestId("realtor-build")).toBeDisabled();

	await page.getByTestId("realtor-close").click();
	await expect(page.getByTestId("realtor-window")).toHaveCount(0);
});

test("a player with materials and coin can build the brewery", async ({
	page,
}) => {
	const name = uniqueName("builder");
	await registerFast(page, name, { area: "marketplace" });

	// Fund the wallet and stock the exact brewery order through the API.
	await page.request.post(`${BASE}/api/economy/transaction`, {
		data: { delta: 7_000 },
	});
	for (const [item, quantity] of [
		["wood-plank", 20],
		["stone", 20],
		["nails", 100],
	] as const) {
		const bought = await page.request.post(`${BASE}/api/hardware/buy`, {
			data: { item, quantity },
		});
		expect(bought.ok()).toBeTruthy();
	}

	await page.reload();
	await waitForWorld(page);
	await walkToRealtor(page);
	await useDoor(page);

	await expect(page.getByTestId("realtor-require-wood-plank")).toContainText(
		"20/20",
	);
	await expect(page.getByTestId("realtor-require-stone")).toContainText("20/20");
	await expect(page.getByTestId("realtor-require-nails")).toContainText(
		"100/100",
	);
	await expect(page.getByTestId("realtor-build")).toBeEnabled();

	await page.getByTestId("realtor-build").click();
	await expect(page.getByTestId("realtor-built")).toBeVisible();
	await expect(page.getByTestId("realtor-message")).toContainText("built");
	

	// The brewery becomes a carried inventory item, then places on the home farm.
	await page.getByTestId("realtor-close").click();
	await page.goto(worldUrl("farm-map"));
	await waitForWorld(page);
	await page.getByTestId("open-inventory").click();
	const brewerySlot = page
		.getByTestId("inventory-panel")
		.locator('[data-item="brewery"]');
	await expect(brewerySlot).toHaveCount(1);
	await brewerySlot.click();
	await page.keyboard.press("Escape");
	await clickWorld(page, 576, 576);
	await expect(page.locator('[data-item="brewery"]')).toHaveCount(0);

	// The placed brewery opens a screen; rare crops are rejected with a reason.
	await page.request.post(`${BASE}/api/dev/npc`, {
		data: { barn: { wheat: 10 } },
	});
	await expect(page.getByTestId("travel-prompt")).toContainText("brewery");
	await useDoor(page);
	await expect(page.getByTestId("brewery-window")).toBeVisible();
	await page.getByTestId("brewery-crop-midas_wheat").click();
	await expect(page.getByTestId("brewery-message")).toContainText(
		"standard wheat",
	);

	await page.getByTestId("brewery-crop-wheat").click();
	await expect(page.getByTestId("brewery-start")).toBeEnabled();
	await page.getByTestId("brewery-start").click();
	await expect(page.getByTestId("brewery-last-output")).toContainText("Beer", {
		timeout: 15_000,
	});

	await page.getByTestId("brewery-close").click();
	await expect(page.locator('[data-item="beer"]')).toHaveCount(1);
});
