import type { ActiveFarm } from "../../shared/types";
import {
	isMovablePropAsset,
	props,
	PURCHASABLE_PROP_TEMPLATES,
	type MapProp,
	type MovablePropKey,
} from "./mapData";

export interface PlacedFarmProp extends MapProp { index: number }
type Override = ActiveFarm["prop_overrides"][number];

/** Apply per-farm overrides to the shared starter layout; the train stays fixed. */
export function placedFarmProps(overrides: Override[]): PlacedFarmProp[] {
	const byIndex = new Map(overrides.map((change) => [change.index, change]));
	const starter = props.flatMap((original, index) => {
		const change = byIndex.get(index);
		if (!change || original.asset === "starter-train" || change.asset !== original.asset)
			return [{ ...original, index }];
		if (change.carried) return [];
		return [{ ...original, x: change.x, y: change.y, index }];
	});
	const purchased = overrides.flatMap((change) => {
		if (change.carried || props[change.index]) return [];
		const template = PURCHASABLE_PROP_TEMPLATES[change.asset as MovablePropKey];
		if (!template || template.asset !== change.asset) return [];
		return [{ ...template, x: change.x, y: change.y, index: change.index }];
	});
	return [...starter, ...purchased];
}

export function movablePropAt(index: number): MovablePropKey | null {
	const asset = props[index]?.asset;
	return asset && isMovablePropAsset(asset) ? asset : null;
}
