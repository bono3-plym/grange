import * as ex from "excalibur";
import type { FarmTileState, FarmToolId } from "../../shared/farm";
import type { FarmAction } from "../../shared/types";
import { emitFarmAction } from "../socket";
import { useGameStore } from "../store";
import { InputManager } from "./InputManager";
import {
	MAP_COLUMNS,
	MAP_HEIGHT,
	MAP_ROWS,
	MAP_WIDTH,
	TILE_SIZE,
	fieldTileToWorld,
	props,
	terrainAt,
	worldToFieldTile,
} from "./mapData";
import { propImages, terrainFrames, terrainImage } from "./resources";

const TILE_COLORS: Record<FarmTileState, ex.Color> = {
	tilled: ex.Color.fromHex("#7a4a22"),
	planted: ex.Color.fromHex("#8bc34a"),
	watered: ex.Color.fromHex("#4a7fb5"),
	ready: ex.Color.fromHex("#e0a020"),
};

const TOOL_KEYS: Record<string, FarmToolId> = {
	Digit1: "hoe",
	Digit2: "seed",
	Digit3: "bucket",
	Digit4: "scythe",
};

const TOOL_KIND: Record<FarmToolId, FarmAction["kind"]> = {
	hoe: "till",
	seed: "plant",
	bucket: "water",
	scythe: "harvest",
};

interface TileActor {
	actor: ex.Actor;
	state: FarmTileState;
}

export class FarmMapScene extends ex.Scene {
	private inputManager!: InputManager;
	private player!: ex.Actor;
	private readonly tiles = new Map<string, TileActor>();
	private readonly playerSpeed = 160; // Pixels per second

	constructor(
		private readonly owner: string,
		private readonly isOwner: boolean,
	) {
		super();
	}

	override onInitialize(): void {
		this.backgroundColor = ex.Color.fromHex("#79a44d");

		this.inputManager = new InputManager();

		const sheet = ex.SpriteSheet.fromImageSource({
			image: terrainImage,
			grid: {
				rows: 4,
				columns: 4,
				spriteWidth: TILE_SIZE,
				spriteHeight: TILE_SIZE,
			},
		});

		const terrain = new ex.TileMap({
			pos: ex.vec(0, 0),
			tileWidth: TILE_SIZE,
			tileHeight: TILE_SIZE,
			columns: MAP_COLUMNS,
			rows: MAP_ROWS,
			renderFromTopOfGraphic: true,
		});

		for (let row = 0; row < MAP_ROWS; row += 1) {
			for (let column = 0; column < MAP_COLUMNS; column += 1) {
				const frame = terrainFrames[terrainAt(column, row)];
				terrain
					.getTile(column, row)
					?.addGraphic(sheet.getSprite(frame.column, frame.row));
			}
		}
		this.add(terrain);

		for (const prop of props) {
			const source = propImages[prop.asset];
			const sprite = source.toSprite();
			const scale = prop.width / source.width;
			sprite.scale = ex.vec(scale, scale);

			const actor = new ex.Actor({
				pos: ex.vec(prop.x, prop.y),
				anchor: ex.vec(0.5, 1),
				z: 100 + Math.floor(prop.y),
			});
			actor.graphics.use(sprite);
			this.add(actor);
		}

		this.player = new ex.Actor({
			pos: ex.vec(MAP_WIDTH / 2, MAP_HEIGHT / 2),
			width: 32,
			height: 32,
			color: ex.Color.fromHex("#ffcc00"),
			anchor: ex.vec(0.5, 1),
			z: 200,
		});
		this.add(this.player);

		this.camera.pos = ex.vec(MAP_WIDTH / 2, MAP_HEIGHT / 2);
	}

	override onPreUpdate(_engine: ex.Engine, _delta: number): void {
		const dir = this.inputManager.getMovementVector();
		this.player.vel = ex.vec(dir.x * this.playerSpeed, dir.y * this.playerSpeed);

		this.player.z = 100 + Math.floor(this.player.pos.y);
		this.player.pos.x = Math.max(16, Math.min(MAP_WIDTH - 16, this.player.pos.x));
		this.player.pos.y = Math.max(32, Math.min(MAP_HEIGHT, this.player.pos.y));

		this.camera.pos = this.player.pos;

		this.syncTiles();
		this.handleToolKeys();
	}

	override onDeactivate(): void {
		this.inputManager?.destroy();
	}

	private syncTiles(): void {
		const farm = useGameStore.getState().activeFarm;
		const live = new Set<string>();

		if (farm) {
			for (const tile of farm.tiles) {
				const key = `${tile.x},${tile.y}`;
				live.add(key);
				const existing = this.tiles.get(key);

				if (existing && existing.state === tile.state) continue;

				const { x, y } = fieldTileToWorld(tile.x, tile.y);
				const actor =
					existing?.actor ??
					new ex.Actor({
						pos: ex.vec(x, y),
						width: 44,
						height: 44,
						anchor: ex.vec(0.5, 0.5),
						z: 50,
					});

				actor.graphics.use(
					new ex.Rectangle({
						width: 44,
						height: 44,
						color: TILE_COLORS[tile.state],
					}),
				);

				if (!existing) {
					this.add(actor);
					this.tiles.set(key, { actor, state: tile.state });
				} else {
					existing.state = tile.state;
				}
			}
		}

		for (const [key, tile] of this.tiles) {
			if (!live.has(key)) {
				tile.actor.kill();
				this.tiles.delete(key);
			}
		}
	}

	private handleToolKeys(): void {
		for (const [key, tool] of Object.entries(TOOL_KEYS)) {
			if (this.inputManager.consumePressed(key)) {
				useGameStore.getState().setTool(tool);
			}
		}

		if (this.isOwner && this.inputManager.consumePressed("Space")) {
			this.actOnPlayerTile();
		}
	}

	private actOnPlayerTile(): void {
		const tile = worldToFieldTile(this.player.pos.x, this.player.pos.y);
		if (!tile) return;

		const tool = useGameStore.getState().tool;
		emitFarmAction(this.owner, {
			kind: TOOL_KIND[tool],
			x: tile.x,
			y: tile.y,
		});
	}
}
