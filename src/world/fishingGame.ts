import {
	FISH,
	type FishDef,
	type FishId,
	RODS,
	type RodId,
} from "./fishingData";

/** Draw weight of each rarity at luck 0. Lower is rarer. */
const RARITY_WEIGHT: Record<FishDef["rarity"], number> = {
	common: 100,
	uncommon: 34,
	rare: 9,
	legendary: 2,
};

/** How strongly luck amplifies each rarity. Rarer fish benefit more. */
const LUCK_GAIN: Record<FishDef["rarity"], number> = {
	common: 0.04,
	uncommon: 0.18,
	rare: 0.5,
	legendary: 0.9,
};

export type Rng = () => number;

/** The draw weight of a fish given a rod's luck. */
export function fishWeight(fish: FishDef, luck: number): number {
	const base = fish.baseWeight ?? RARITY_WEIGHT[fish.rarity];
	return base * (1 + Math.max(0, luck) * LUCK_GAIN[fish.rarity]);
}

/** Luck of the equipped rod, defaulting to 0 for an unknown id. */
export function rodLuck(rod: RodId): number {
	return RODS[rod]?.luck ?? 0;
}

/** Picks a fish at random, biased toward rarer fare as luck rises. */
export function rollCatch(luck: number, rng: Rng = Math.random): FishDef {
	const entries = Object.values(FISH);
	const total = entries.reduce((sum, fish) => sum + fishWeight(fish, luck), 0);
	if (total <= 0) return entries[0];

	let roll = rng() * total;
	for (const fish of entries) {
		roll -= fishWeight(fish, luck);
		if (roll < 0) return fish;
	}
	return entries[entries.length - 1];
}

/** How long the bobber waits before a fish bites (ms). */
export function castDelayMs(rng: Rng = Math.random): number {
	return 700 + Math.floor(rng() * 1500);
}

/** How long the player has to reel in once a fish bites (ms). */
export function biteWindowMs(luck: number): number {
	return 1300 + Math.round(Math.max(0, luck) * 90);
}

/**
 * The Grangecoin skimming from a rival's earnings. Approximates "steal 10%"
 * client-side: it takes a tenth of a randomised rival takings pool.
 */
export function phishingBounty(rng: Rng = Math.random): number {
	return Math.round((100 + rng() * 900) * 0.1);
}

/** The economy side-effects a catch can trigger. */
export interface FishingBank {
	/** Credits Grangecoin to the player (phishing takings). */
	deposit: (amount: number) => void;
	/** Wipes a negative balance and returns how much debt was erased. */
	clearDebt: () => number;
}

export interface CatchResult {
	fish: FishDef;
	/** Grangecoin credited on the spot (only phishing does this). */
	coins: number;
	message: string;
}

/** Applies a caught fish's special effect and describes what happened. */
export function resolveCatch(
	fish: FishDef,
	bank: FishingBank,
	rival = "a rival",
	rng: Rng = Math.random,
): CatchResult {
	if (fish.effect === "steal") {
		const coins = phishingBounty(rng);
		bank.deposit(coins);
		return {
			fish,
			coins,
			message: `Phishing! You skimmed $${coins} of ${rival}'s earnings.`,
		};
	}

	if (fish.effect === "clear-debt") {
		const cleared = bank.clearDebt();
		return {
			fish,
			coins: 0,
			message:
				cleared > 0
					? `The Loan Shark's Brother wiped out your $${cleared} debt!`
					: "The Loan Shark's Brother surfaced — but you had no debt to erase.",
		};
	}

	return { fish, coins: 0, message: `You caught a ${fish.name}!` };
}

/** Picks a rival name to blame for a phishing haul (excludes the player). */
export function pickRival(
	player: string,
	others: readonly string[],
	rng: Rng = Math.random,
): string {
	const candidates = others.filter((name) => name && name !== player);
	if (candidates.length === 0) return "a rival";
	return candidates[Math.floor(rng() * candidates.length)];
}

/** The stable list of fish ids, for building counters and tests. */
export function fishIds(): FishId[] {
	return Object.keys(FISH) as FishId[];
}
