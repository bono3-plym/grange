import { BREWERY } from "./realtorData";
import { RealtorWindow } from "./RealtorWindow";
import type { RealtorController } from "./useRealtor";

interface RealtorPanelProps {
	realtor: RealtorController;
	onClose: () => void;
}

/** Renders the realtor window only while the listing is open. */
export function RealtorPanel({ realtor, onClose }: RealtorPanelProps) {
	if (!realtor.realtorOpen) return null;
	return (
		<RealtorWindow
			owned={realtor.realtorOwned.includes(BREWERY.id)}
			materials={realtor.materials}
			busy={realtor.realtorBusy}
			message={realtor.realtorMessage}
			onBuild={realtor.buildBrewery}
			onClose={onClose}
		/>
	);
}
