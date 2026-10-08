import * as ex from "excalibur";
import { InputManager } from "./InputManager";
import { MAP_HEIGHT, MAP_WIDTH } from "./mapData";
import { updateWalkingPlayer } from "./playerMovement";

export type WorldArea = "Farm" | "Marketplace" | "Casino";
export type WorldSceneName = "farm-map" | "marketplace" | "casino";

export interface SceneSpawn {
	x: number;
	y: number;
}

export interface SceneInteraction {
	position: ex.Vector;
	prompt: string;
	radius?: number;
	/** Travel to another scene when pressed. Omit for an in-place action. */
	destination?: WorldSceneName;
	destinationSpawn?: SceneSpawn;
	/** Run an in-place action (e.g. open a shop window) instead of travelling. */
	onInteract?: () => void;
}

interface SceneActivationData {
	spawn?: SceneSpawn;
}

interface WalkingSceneOptions {
	area: WorldArea;
	spawn: ex.Vector;
	interactions: SceneInteraction[];
	onAreaChange: (area: WorldArea) => void;
	onPromptChange: (prompt: string | null) => void;
}

export abstract class WalkingScene extends ex.Scene<SceneActivationData> {
	protected player!: ex.Actor;
	protected inputManager?: InputManager;
	private activePrompt: string | null = null;
	private traveling = false;
	private paused = false;
	private readonly playerSpeed = 160;

	constructor(private readonly options: WalkingSceneOptions) {
		super();
	}

	protected addPlayer(): void {
		this.player = new ex.Actor({
			pos: this.options.spawn.clone(),
			width: 32,
			height: 32,
			color: ex.Color.fromHex("#ffcc00"),
			anchor: ex.vec(0.5, 1),
			z: 200,
		});
		this.add(this.player);
		this.camera.pos = ex.vec(MAP_WIDTH / 2, MAP_HEIGHT / 2);
	}

	override onActivate(
		context: ex.SceneActivationContext<SceneActivationData>,
	): void {
		const spawn = context.data?.spawn;
		this.player.pos = spawn
			? ex.vec(spawn.x, spawn.y)
			: this.options.spawn.clone();
		this.inputManager = new InputManager();
		this.traveling = false;
		this.paused = false;
		this.options.onAreaChange(this.options.area);
		this.setPrompt(null);
	}

	/** Freeze or resume the player, e.g. while a shop window is open. */
	setPaused(paused: boolean): void {
		this.paused = paused;
		this.player.vel = ex.Vector.Zero;
		this.inputManager?.clear();
	}

	override onPreUpdate(engine: ex.Engine): void {
		if (!this.inputManager) return;
		if (this.paused) {
			this.player.vel = ex.Vector.Zero;
			this.inputManager.clear();
			return;
		}
		const direction = this.inputManager.getMovementVector();
		updateWalkingPlayer(this.player, direction, this.playerSpeed);

		const interaction = this.options.interactions.find(
			(candidate) =>
				this.player.pos.distance(candidate.position) <=
				(candidate.radius ?? 115),
		);
		this.setPrompt(interaction?.prompt ?? null);
		if (
			interaction &&
			!this.traveling &&
			this.inputManager.consumePress("KeyE", "Enter")
		) {
			if (interaction.onInteract) {
				this.paused = true;
				this.player.vel = ex.Vector.Zero;
				this.setPrompt(null);
				interaction.onInteract();
			} else if (interaction.destination) {
				this.traveling = true;
				this.setPrompt(null);
				void engine.goToScene(interaction.destination, {
					sceneActivationData: { spawn: interaction.destinationSpawn },
				});
			}
		}
	}

	override onDeactivate(): void {
		this.player.vel = ex.Vector.Zero;
		this.inputManager?.destroy();
		this.inputManager = undefined;
		this.setPrompt(null);
	}

	private setPrompt(prompt: string | null): void {
		if (prompt === this.activePrompt) return;
		this.activePrompt = prompt;
		this.options.onPromptChange(prompt);
	}
}
