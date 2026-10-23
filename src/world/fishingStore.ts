import { create } from "zustand";
import { type FishId, type RodId, STARTER_ROD } from "./fishingData";

export type FishCounts = Partial<Record<FishId, number>>;

interface FishingState {
	/** Fish in the player's creel, by id. */
	fish: FishCounts;
	/** The rod currently in hand. Ownership lives in the inventory. */
	equippedRod: RodId;
	addFish: (id: FishId, count?: number) => void;
	/** Removes up to `count` and returns how many were actually removed. */
	sellFish: (id: FishId, count: number) => number;
	equipRod: (id: RodId) => void;
	resetFishing: () => void;
}

function initialFishing() {
	return {
		fish: {} as FishCounts,
		equippedRod: STARTER_ROD,
	};
}

export const useFishingStore = create<FishingState>((set, get) => ({
	...initialFishing(),

	addFish: (id, count = 1) => {
		if (count <= 0) return;
		set((state) => ({
			fish: { ...state.fish, [id]: (state.fish[id] ?? 0) + count },
		}));
	},

	sellFish: (id, count) => {
		if (count <= 0) return 0;
		const held = get().fish[id] ?? 0;
		const sold = Math.min(held, Math.floor(count));
		if (sold <= 0) return 0;
		const next = { ...get().fish };
		const remaining = held - sold;
		if (remaining > 0) next[id] = remaining;
		else delete next[id];
		set({ fish: next });
		return sold;
	},

	equipRod: (id) => set({ equippedRod: id }),

	resetFishing: () => set(initialFishing()),
}));

/** How many of a fish the player is holding. */
export function countFish(
	state: Pick<FishingState, "fish">,
	id: FishId,
): number {
	return state.fish[id] ?? 0;
}
