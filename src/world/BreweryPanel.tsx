import { BreweryWindow } from "./BreweryWindow";
import type { BreweryController } from "./useBrewery";

interface BreweryPanelProps {
	brewery: BreweryController;
	onClose: () => void;
}

/** Renders the brewery screen only while it is open. */
export function BreweryPanel({ brewery, onClose }: BreweryPanelProps) {
	if (!brewery.breweryOpen) return null;
	return (
		<BreweryWindow
			brewery={brewery.brewery}
			barn={brewery.barn}
			message={brewery.breweryMessage}
			busy={brewery.breweryBusy}
			onInsert={brewery.insertCrop}
			onRemove={brewery.removeCrop}
			onStart={brewery.startBrew}
			onClose={onClose}
		/>
	);
}
