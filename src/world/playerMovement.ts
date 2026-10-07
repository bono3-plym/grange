import * as ex from "excalibur";
import type { InputVector } from "./InputManager";
import { MAP_HEIGHT, MAP_WIDTH } from "./mapData";

export function updateWalkingPlayer(
	player: ex.Actor,
	direction: InputVector,
	speed: number,
): void {
	player.vel = ex.vec(direction.x * speed, direction.y * speed);
	player.z = 100 + Math.floor(player.pos.y);
	player.pos.x = ex.clamp(player.pos.x, 16, MAP_WIDTH - 16);
	player.pos.y = ex.clamp(player.pos.y, 32, MAP_HEIGHT);
}
