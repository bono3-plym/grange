import { expect, test } from "@playwright/test";
import {
	BASE,
	clickFarmTile,
	clickWorld,
	expectArea,
	movePlayerNear,
	registerFast,
	uniqueName,
	useDoor,
	waitForWorld,
	walkToBank,
	walkUntilPrompt,
} from "./helpers";

test("the bank has teller and mayor desks, with saved money and land purchases", async ({
	page,
}) => {
	await registerFast(page, uniqueName("Banker"), { area: "marketplace" });

	await walkToBank(page);
	await useDoor(page);
	await expectArea(page, /^Bank map/, 10_000);

	await walkUntilPrompt(page, ["w", "a"], "talk to bank teller", 30_000);
	await useDoor(page);
	const teller = page.getByRole("dialog", { name: "Talk to bank teller" });
	await expect(teller).toBeVisible();
	await teller.getByLabel("Amount").fill("20");
	await teller.getByRole("button", { name: "Deposit" }).click();
	await expect(teller).toContainText("Savings: $20");
	await teller.getByRole("button", { name: "Withdraw" }).click();
	await expect(teller).toContainText("Savings: $0");
	await page.keyboard.press("Escape");

	await walkUntilPrompt(page, ["d"], "talk to mayor", 30_000);
	await useDoor(page);
	const mayor = page.getByRole("dialog", { name: "Talk to mayor" });
	await expect(mayor).toContainText("Next parcel: $250");
	await expect(mayor.getByRole("button", { name: "Buy land" })).toBeDisabled();
});

test("the final land parcel is walkable and farmable to the map border", async ({
	page,
}) => {
	await registerFast(page, uniqueName("Border"));

	// Before buying land, pressing into the owned edge points at the mayor.
	// Walk to the top border deterministically; a fixed key hold is too short
	// on a loaded CI runner.
	await movePlayerNear(page, 576, 32, 4, { reach: 0 });
	await page.keyboard.down("w");
	try {
		await expect(page.getByTestId("notification-feed")).toContainText(
			"Talk with the Mayor to purchase more land.",
			{ timeout: 10_000 },
		);
	} finally {
		await page.keyboard.up("w");
	}

	await page.request.post(`${BASE}/api/economy/transaction`, {
		data: { delta: 10_000 },
	});
	for (let level = 1; level <= 5; level += 1) {
		const response = await page.request.post(`${BASE}/api/land/buy`, {
			data: {},
		});
		expect(response.ok()).toBeTruthy();
		expect((await response.json()) as { land_level: number }).toMatchObject({
			land_level: level,
		});
	}

	await page.reload();
	await waitForWorld(page);

	// The expanded north-west land accepts walking. Walk deterministically to
	// the top edge, then across it; fixed key holds are too short on CI.
	await movePlayerNear(page, 576, -224, 8, { reach: 0 });
	await movePlayerNear(page, -368, -224, 8, { reach: 0 });
	const position = await page.evaluate(() => {
		const el = document.querySelector(".farm-map-page");
		return {
			x: Number(el?.getAttribute("data-player-x")),
			y: Number(el?.getAttribute("data-player-y")),
		};
	});
	expect(position.x).toBeLessThan(0);
	expect(position.y).toBeLessThan(0);

	// Crops and fences work on the newly purchased edge tiles.
	await page.keyboard.press("1");
	await clickFarmTile(page, -4, -3);
	await expect(page.getByTestId("farm-tile")).toContainText(
		"(-4, -3): tilled",
		{ timeout: 10_000 },
	);
	await page.keyboard.press("6");
	await clickWorld(page, -4 * 64, -2 * 64);
	await expect(page.getByTestId("slot-hotbar-5")).toHaveAttribute(
		"data-count",
		"19",
		{ timeout: 10_000 },
	);
});
