import { beforeEach, describe, expect, it } from "vitest";
import { countFish, useFishingStore } from "./fishingStore";

const store = () => useFishingStore.getState();

describe("fishing store", () => {
	beforeEach(() => store().resetFishing());

	it("starts with the starter rod equipped and an empty creel", () => {
		expect(store().equippedRod).toBe("bamboo");
		expect(countFish(store(), "minnow")).toBe(0);
	});

	it("stacks caught fish by id", () => {
		store().addFish("minnow");
		store().addFish("minnow", 2);
		expect(countFish(store(), "minnow")).toBe(3);
	});

	it("ignores non-positive catches", () => {
		store().addFish("carp", 0);
		store().addFish("carp", -3);
		expect(countFish(store(), "carp")).toBe(0);
	});

	it("sells no more fish than are held", () => {
		store().addFish("trout", 2);
		expect(store().sellFish("trout", 5)).toBe(2);
		expect(countFish(store(), "trout")).toBe(0);
	});

	it("leaves the remainder when selling part of a stack", () => {
		store().addFish("salmon", 4);
		expect(store().sellFish("salmon", 1)).toBe(1);
		expect(countFish(store(), "salmon")).toBe(3);
	});

	it("reports nothing sold from an empty creel", () => {
		expect(store().sellFish("carp", 1)).toBe(0);
	});

	it("equips any rod it is handed", () => {
		store().equipRod("master");
		expect(store().equippedRod).toBe("master");
	});

	it("comes back blank after a reset", () => {
		store().addFish("phishing", 2);
		store().equipRod("master");
		store().resetFishing();
		expect(store().equippedRod).toBe("bamboo");
		expect(countFish(store(), "phishing")).toBe(0);
	});
});
