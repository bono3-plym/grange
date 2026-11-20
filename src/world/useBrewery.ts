import { useCallback, useState } from "react";
import type { BreweryAction } from "../../shared/types";
import { emitBreweryAction } from "./brewerySocket";
import { useGameStore } from "../store";

/** Brewery overlay state and the owner-only insert/remove/start actions. */
export function useBrewery(owner: string | undefined, onClose?: () => void) {
	const [open, setOpen] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const brewery = useGameStore((s) => s.activeFarm?.brewery ?? null);
	const barn = useGameStore((s) => s.activeFarm?.barn ?? {});

	const openBrewery = useCallback(() => {
		setOpen(true);
		setMessage(null);
	}, []);

	const closeBrewery = useCallback(() => {
		if (busy) return;
		setOpen(false);
		setMessage(null);
		onClose?.();
	}, [busy, onClose]);

	const act = useCallback(
		(action: BreweryAction) => {
			if (!owner || busy) return;
			setBusy(true);
			setMessage(null);
			emitBreweryAction(owner, action, (res) => {
				setBusy(false);
				if (!res.ok) {
					setMessage(res.error ?? "Brewery action failed.");
					return;
				}
				const farm = useGameStore.getState().activeFarm;
				if (farm) {
					useGameStore.getState().setActiveFarm({
						...farm,
						brewery: res.brewery ?? farm.brewery,
						barn: res.barn ?? farm.barn,
					});
				}
			});
		},
		[owner, busy],
	);

	return {
		breweryOpen: open,
		brewery,
		barn,
		breweryMessage: message,
		breweryBusy: busy,
		openBrewery,
		closeBrewery,
		insertCrop: (item: string) => act({ kind: "insert", item }),
		removeCrop: () => act({ kind: "remove" }),
		startBrew: () => act({ kind: "start" }),
	};
}

export type BreweryController = ReturnType<typeof useBrewery>;
