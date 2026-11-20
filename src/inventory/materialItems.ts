import type { ItemDef } from "./items";

/** Building materials sold at the hardware store and spent on real estate. */
export const MATERIAL_ITEMS = ["wood-plank", "stone", "nails"] as const;
export type MaterialItemId = (typeof MATERIAL_ITEMS)[number];

export const MATERIAL_ITEM_DEFS: Record<MaterialItemId, ItemDef> = {
	"wood-plank": {
		id: "wood-plank", name: "Wood Planks", kind: "material", maxStack: 99,
		icon: "/assets/items/wood-planks.png",
		description: "Sawn timber for buildings. Bought at the hardware store.",
	},
	stone: {
		id: "stone", name: "Stone", kind: "material", maxStack: 99,
		icon: "/assets/items/stone.png",
		description: "Rough quarried stone for foundations. Bought at the hardware store.",
	},
	nails: {
		id: "nails", name: "Nails", kind: "material", maxStack: 99,
		icon: "/assets/items/nails.png",
		description: "Iron nails for timber work. Bought at the hardware store.",
	},
};
