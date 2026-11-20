/** The first real-estate listing: a buildable brewery. */
export const BREWERY = {
	id: "brewery",
	name: "Brewery",
	price: 5_000,
	materials: {
		"wood-plank": 20,
		stone: 20,
		nails: 100,
	},
	blurb:
		"A working brewhouse for your farm. The realtor handles the permits; you supply the timber, stone, nails, and coin.",
} as const;
