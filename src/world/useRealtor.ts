import { useCallback, useState } from "react";
import { countItem, useInventoryStore } from "../inventory/inventoryStore";
import {
	MATERIAL_ITEMS,
	type MaterialItemId,
} from "../inventory/materialItems";
import { economy } from "./EconomyManager";
import { BREWERY } from "./realtorData";

interface RealtorResponse {
	ok: boolean;
	owned?: string[];
	materials?: Record<string, number>;
	prop_inventory?: Record<string, number>;
	balance?: number;
	error?: string;
}

function applyServer(data: RealtorResponse): string[] {
	const state = useInventoryStore.getState();
	if (typeof data.balance === "number") economy.setBalance(data.balance);
	for (const id of MATERIAL_ITEMS) {
		const count = data.materials?.[id];
		if (typeof count === "number") state.setItemCount(id, count);
	}
	const brewery = data.prop_inventory?.brewery;
	if (typeof brewery === "number") state.setItemCount("brewery", brewery);
	return data.owned ?? [];
}

/** Loads the realtor catalogue and drives the brewery construction purchase. */
export function useRealtor(onClose?: () => void) {
	const grid = useInventoryStore((s) => s.grid);
	const hotbar = useInventoryStore((s) => s.hotbar);
	const [open, setOpen] = useState(false);
	const [owned, setOwned] = useState<string[]>([]);
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState<string | null>(null);

	const inventory = { grid, hotbar };
	const materials = Object.fromEntries(
		MATERIAL_ITEMS.map((id) => [id, countItem(inventory, id)]),
	) as Record<MaterialItemId, number>;

	const openRealtor = useCallback(async () => {
		setOpen(true);
		setMessage(null);
		try {
			const res = await fetch("/api/realtor", { credentials: "same-origin" });
			const data = (await res.json()) as RealtorResponse;
			if (!res.ok || !data.ok) {
				setMessage(data.error ?? "Could not read the realtor's listings.");
				return;
			}
			setOwned(applyServer(data));
		} catch {
			setMessage("Could not reach the realtor.");
		}
	}, []);

	const closeRealtor = useCallback(() => {
		if (busy) return;
		setOpen(false);
		setMessage(null);
		onClose?.();
	}, [busy, onClose]);

	const buildBrewery = useCallback(async () => {
		if (busy || owned.includes(BREWERY.id)) return;
		setBusy(true);
		setMessage(null);
		try {
			const res = await fetch("/api/realtor/build", {
				method: "POST",
				credentials: "same-origin",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ property: BREWERY.id }),
			});
			const data = (await res.json()) as RealtorResponse;
			if (!res.ok || !data.ok || data.balance === undefined) {
				setMessage(data.error ?? "Construction failed.");
				return;
			}
			const next = applyServer(data);
			setOwned(next.includes(BREWERY.id) ? next : [...next, BREWERY.id]);
			setMessage("The brewery is built! Your foreman will handle the rest.");
		} catch {
			setMessage("Could not reach the realtor.");
		} finally {
			setBusy(false);
		}
	}, [busy, owned]);

	return {
		realtorOpen: open,
		realtorOwned: owned,
		realtorBusy: busy,
		realtorMessage: message,
		materials,
		openRealtor,
		closeRealtor,
		buildBrewery,
	};
}

export type RealtorController = ReturnType<typeof useRealtor>;
