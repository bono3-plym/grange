import type { ItemDef } from "./items";

/** Finished drinks produced by the brewery. */
export const BREW_ITEM_IDS = ["beer", "tomato_juice", "lettuce_juice"] as const;
export type BrewItemId = (typeof BREW_ITEM_IDS)[number];

export const BREW_ITEM_DEFS: Record<BrewItemId, ItemDef> = {
	beer: {
		id: "beer", name: "Beer", kind: "drink", maxStack: 99,
		icon: "/assets/items/beer.png",
		description: "Brewed from wheat. A future market good.",
	},
	tomato_juice: {
		id: "tomato_juice", name: "Tomato Juice", kind: "drink", maxStack: 99,
		icon: "/assets/items/tomato-juice.png",
		description: "Brewed from tomatoes. A future market good.",
	},
	lettuce_juice: {
		id: "lettuce_juice", name: "Lettuce Juice", kind: "drink", maxStack: 99,
		icon: "/assets/items/lettuce-juice.png",
		description: "Brewed from lettuce. A future market good.",
	},
};
