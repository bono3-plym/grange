import { describe, expect, it } from "vitest";
import {
	BREW_RECIPES,
	formatBrewCountdown,
	withinBreweryReach,
} from "./breweryData";

describe("brewery data", () => {
	it("maps only standard crops to drinks", () => {
		expect(BREW_RECIPES).toEqual({
			wheat: "beer",
			tomato: "tomato_juice",
			lettuce: "lettuce_juice",
		});
	});

	it("formats the one-hour countdown", () => {
		expect(formatBrewCountdown(3_600_000)).toBe("1:00:00");
		expect(formatBrewCountdown(59_000)).toBe("00:59");
		expect(formatBrewCountdown(0)).toBe("00:00");
	});

	it("only opens the brewery from nearby", () => {
		expect(withinBreweryReach({ x: 400, y: 500 }, { x: 400, y: 400 })).toBe(
			true,
		);
		expect(withinBreweryReach({ x: 900, y: 500 }, { x: 400, y: 400 })).toBe(
			false,
		);
	});
});
