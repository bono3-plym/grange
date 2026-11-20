import { CROP_ITEMS, type ItemId } from "../inventory/items";

/** Barn keys that are not crops but still mirror into the player inventory. */
const BREW_OUTPUT_ITEMS: Record<string, ItemId> = {
	beer: "beer",
	tomato_juice: "tomato_juice",
	lettuce_juice: "lettuce_juice",
};

const BARN_ITEMS: Record<string, ItemId> = {
	...CROP_ITEMS,
	...BREW_OUTPUT_ITEMS,
};

/** Inventory primitives the reconciler needs, injected for testability. */
export interface BarnReconcileActions {
	addItem: (itemId: ItemId, count: number) => void;
	removeItem: (itemId: ItemId, count: number) => void;
	countItem: (itemId: ItemId) => number;
}

/**
 * Makes the local inventory match the authoritative server barn exactly, per
 * crop. The barn is the single source of truth for produce, so reconciling (as
 * opposed to applying a delta from a remembered baseline) is idempotent: it
 * can't double-count across remounts or reloads, and it removes items again
 * when the barn shrinks after a sale.
 */
export function reconcileBarn(
	barn: Record<string, number>,
	actions: BarnReconcileActions,
): void {
	for (const [barnKey, itemId] of Object.entries(BARN_ITEMS)) {
		const desired = barn[barnKey] ?? 0;
		const actual = actions.countItem(itemId);
		if (desired > actual) actions.addItem(itemId, desired - actual);
		else if (desired < actual) actions.removeItem(itemId, actual - desired);
	}
}
