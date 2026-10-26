import { useInventoryStore } from "../inventory/inventoryStore";
import { emitFarmAction } from "../socket";
import { useGameStore } from "../store";
import type { BlockRegistry } from "./blocking";
import { fenceInBounds, fenceKey } from "./fenceData";
import { isTillableTile, TILE_SIZE } from "./mapData";

export function selectedFarmItem() {
	const inventory = useInventoryStore.getState();
	return inventory.hotbar[inventory.selectedHotbar]?.itemId ?? null;
}

export function actOnFence(owner: string, column: number, row: number,
	item: "fence" | "gate" | "shovel", blocks: BlockRegistry,
	player: { x: number; y: number }, report: (message: string) => void): void {
	const farm = useGameStore.getState().activeFarm;
	if (!farm) return;
	const fences = farm.fences ?? [];
	const gates = farm.gates ?? [];
	const fenceHere = fences.some(({ x, y }) => fenceKey(x, y) === fenceKey(column, row));
	const gateHere = gates.some(({ x, y }) => fenceKey(x, y) === fenceKey(column, row));

	if (item === "fence" || item === "gate") {
		const supply = item === "fence" ? farm.fence_count : farm.gate_count;
		const exists = item === "fence" ? fenceHere : gateHere;
		const occupied = item === "fence" ? gateHere : fenceHere;
		if (!fenceInBounds(column, row) || !isTillableTile(column, row) ||
			blocks.isBlocked(column, row) || exists || occupied || supply <= 0 ||
			(column === Math.floor(player.x / TILE_SIZE) && row === Math.floor(player.y / TILE_SIZE)) ||
			farm.tiles.some((tile) => tile.x === column && tile.y === row)) {
			report(item === "fence" ? "Place fences on clear grass." : "Place gates on clear grass.");
			return;
		}
	}

	if (item === "shovel" && !fenceHere && !gateHere) {
		report("No fence to dig up here.");
		return;
	}

	const kind = item === "fence"
		? "place_fence"
		: item === "gate"
			? "place_gate"
			: gateHere
				? "remove_gate"
				: "remove_fence";

	emitFarmAction(owner, { kind, x: column, y: row }, (result) => {
		if (!result.ok) {
			report(result.error ?? "Could not change fence.");
			return;
		}
		if (item === "fence") report("Fence placed.");
		else if (item === "gate") report("Gate placed.");
		else report(gateHere ? "Gate returned to inventory." : "Fence returned to inventory.");
	});
}
