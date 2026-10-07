import * as ex from "excalibur";
import {
	MARKETPLACE_CASINO_ENTRANCE,
	MARKETPLACE_PLAYER_SPAWN,
	MARKETPLACE_TRAIN_STOP,
	marketplaceProps,
	marketplaceTerrainAt,
} from "./marketplaceData";
import { marketplaceImages } from "./marketplaceResources";
import { addProps, addTerrain } from "./sceneRendering";
import { WalkingScene, type WorldArea } from "./WalkingScene";

export class MarketplaceScene extends WalkingScene {
	constructor(
		onPromptChange: (prompt: string | null) => void,
		onAreaChange: (area: WorldArea) => void,
	) {
		super({
			area: "Marketplace",
			spawn: ex.vec(MARKETPLACE_PLAYER_SPAWN.x, MARKETPLACE_PLAYER_SPAWN.y),
			interactions: [
				{
					position: ex.vec(MARKETPLACE_TRAIN_STOP.x, MARKETPLACE_TRAIN_STOP.y),
					destination: "farm-map",
					prompt: "Press E or Enter to return to the farm",
				},
				{
					position: ex.vec(
						MARKETPLACE_CASINO_ENTRANCE.x,
						MARKETPLACE_CASINO_ENTRANCE.y,
					),
					destination: "casino",
					prompt: "Press E or Enter to enter the casino",
					radius: 90,
				},
			],
			onAreaChange,
			onPromptChange,
		});
	}

	override onInitialize(): void {
		this.backgroundColor = ex.Color.fromHex("#79a44d");
		addTerrain(this, marketplaceTerrainAt);
		addProps(this, marketplaceProps, marketplaceImages);
		this.addPlayer();
	}
}
