import { type CropId, STANDARD_CROPS, CROPS } from "../../shared/crops";

/** Ten crops make one batch. */
export const BREW_BATCH_SIZE = 10;
export const BREW_HOUR_MS = 3_600_000;

/** Standard crop -> finished drink id. Rare crops are intentionally rejected. */
export const BREW_RECIPES: Partial<Record<CropId, string>> = {
	wheat: "beer",
	tomato: "tomato_juice",
	lettuce: "lettuce_juice",
};

export const BREW_EXPLANATION =
	"The brewery ferments 10 of one standard crop. Wheat becomes beer, tomatoes become tomato juice, and lettuce becomes lettuce juice. Rare mutant crops are too delicate for the mash tun.";

/** Standard crops first, then the rare varieties the brewery rejects. */
export const BREW_CROP_ORDER: CropId[] = [
	...STANDARD_CROPS,
	...(Object.keys(CROPS) as CropId[]).filter(
		(id) => !STANDARD_CROPS.includes(id),
	),
];

/** How far from the brewery's base the owner can stand and still open it. */
export const BREWERY_REACH = 150;

export function withinBreweryReach(
	player: { x: number; y: number },
	brewery: { x: number; y: number },
	reach = BREWERY_REACH,
): boolean {
	return Math.hypot(player.x - brewery.x, player.y - brewery.y) <= reach;
}

/** `H:MM:SS` for a countdown, or `0:00` once it is finished. */
export function formatBrewCountdown(remainingMs: number): string {
	const total = Math.max(0, Math.ceil(remainingMs / 1000));
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const seconds = total % 60;
	const tail = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
	return hours > 0 ? `${hours}:${tail}` : tail;
}
