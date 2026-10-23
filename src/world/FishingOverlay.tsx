import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { countItem, useInventoryStore } from "../inventory/inventoryStore";
import { useGameStore } from "../store";
import { economy } from "./EconomyManager";
import {
	FISH,
	FISH_ORDER,
	type FishDef,
	RARITY_LABEL,
	RODS,
	ROD_ORDER,
	STARTER_ROD,
} from "./fishingData";
import {
	biteWindowMs,
	castDelayMs,
	pickRival,
	resolveCatch,
	rodLuck,
	rollCatch,
} from "./fishingGame";
import { useFishingStore } from "./fishingStore";
import { useEconomyBalance } from "./useEconomy";
import "./fishing.css";

type Phase = "idle" | "casting" | "bite" | "caught" | "escaped";

interface FishingOverlayProps {
	onClose: () => void;
}

/**
 * The pond-side mini-game. Cast, wait for a bite, then reel inside the window
 * before it slips away. The equipped rod's luck biases what bites.
 */
export function FishingOverlay({ onClose }: FishingOverlayProps) {
	const username = useGameStore((s) => s.username);
	const players = useGameStore((s) => s.players);
	const fish = useFishingStore((s) => s.fish);
	const equippedId = useFishingStore((s) => s.equippedRod);
	const addFish = useFishingStore((s) => s.addFish);
	const equipRod = useFishingStore((s) => s.equipRod);
	const grid = useInventoryStore((s) => s.grid);
	const hotbar = useInventoryStore((s) => s.hotbar);
	const balance = useEconomyBalance();

	const [phase, setPhase] = useState<Phase>("idle");
	const [message, setMessage] = useState("Cast your line to start fishing.");
	const [caught, setCaught] = useState<FishDef | null>(null);

	const timers = useRef<number[]>([]);
	const awaiting = useRef(false);
	// Rods live in the inventory; the fishing store only remembers the pick.
	const ownedRods = useMemo(
		() => ROD_ORDER.filter((id) => countItem({ grid, hotbar }, id) > 0),
		[grid, hotbar],
	);
	const equippedRod = ownedRods.includes(equippedId)
		? equippedId
		: STARTER_ROD;
	const luck = rodLuck(equippedRod);
	const rod = RODS[equippedRod];

	const clearTimers = useCallback(() => {
		for (const id of timers.current) window.clearTimeout(id);
		timers.current = [];
	}, []);

	useEffect(() => clearTimers, [clearTimers]);

	const bank = useMemo(
		() => ({
			deposit: (amount: number) => {
				economy.sell(amount);
			},
			clearDebt: () => economy.clearDebt(),
		}),
		[],
	);

	const cast = useCallback(() => {
		clearTimers();
		awaiting.current = false;
		setCaught(null);
		setPhase("casting");
		setMessage("You cast the line and watch the bobber…");
		timers.current.push(
			window.setTimeout(() => {
				awaiting.current = true;
				setPhase("bite");
				setMessage("Something's tugging — reel it in!");
				timers.current.push(
					window.setTimeout(() => {
						if (!awaiting.current) return;
						awaiting.current = false;
						setPhase("escaped");
						setMessage("It slipped off the hook. Cast again.");
					}, biteWindowMs(luck)),
				);
			}, castDelayMs()),
		);
	}, [clearTimers, luck]);

	const reel = useCallback(() => {
		if (!awaiting.current) return;
		awaiting.current = false;
		clearTimers();
		const landed = rollCatch(luck);
		const rival = pickRival(
			username,
			players.map((player) => player.name),
		);
		const result = resolveCatch(landed, bank, rival);
		addFish(landed.id, 1);
		setCaught(landed);
		setPhase("caught");
		setMessage(result.message);
	}, [addFish, bank, clearTimers, luck, players, username]);

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if (event.repeat) return;
			if (event.code === "Escape" || event.key === "Escape") {
				event.preventDefault();
				event.stopImmediatePropagation();
				clearTimers();
				onClose();
				return;
			}
			if (event.code === "Space" || event.code === "Enter") {
				event.preventDefault();
				if (phase === "bite") reel();
				else if (phase !== "casting") cast();
			}
		}
		window.addEventListener("keydown", onKeyDown, true);
		return () => window.removeEventListener("keydown", onKeyDown, true);
	}, [cast, clearTimers, onClose, phase, reel]);

	const held = FISH_ORDER.filter((id) => (fish[id] ?? 0) > 0);

	return (
		<div
			className="fish-overlay"
			data-testid="fishing-overlay"
			data-phase={phase}
		>
			<div className="fish-panel" role="dialog" aria-label="Fishing">
				<header className="fish-header">
					<h2 className="fish-title">Fishing</h2>
					<span className="fish-balance" data-testid="fishing-balance">
						${balance.toLocaleString()}
					</span>
					<span className="fish-luck" data-testid="fishing-luck">
						{rod.name} · Luck {luck}
					</span>
					<button
						type="button"
						className="fish-close"
						data-testid="fishing-close"
						onClick={onClose}
					>
						Leave
					</button>
				</header>

				<div
					className={`fish-water fish-water-${phase}`}
					data-testid="fishing-water"
				>
					<img className="fish-rod-icon" src={rod.icon} alt="" />
					<span className="fish-bobber" aria-hidden="true">
						{phase === "bite" ? "❗" : "🎣"}
					</span>
					{caught && (
						<span className="fish-catch" data-testid="fishing-catch">
							<span className="fish-catch-emoji">{caught.emoji}</span>
							<span className="fish-catch-name">{caught.name}</span>
							<span className="fish-catch-rarity">
								{RARITY_LABEL[caught.rarity]} · ${caught.value}
							</span>
						</span>
					)}
				</div>

				<p className="fish-message" data-testid="fishing-message">
					{message}
				</p>

				<div className="fish-actions">
					<button
						type="button"
						className="fish-action fish-primary"
						data-testid="fishing-cast"
						disabled={phase === "casting" || phase === "bite"}
						onClick={cast}
					>
						{phase === "casting" ? "Waiting…" : "Cast line"}
					</button>
					<button
						type="button"
						className={
							phase === "bite" ? "fish-action fish-reel-active" : "fish-action"
						}
						data-testid="fishing-reel"
						disabled={phase !== "bite"}
						onClick={reel}
					>
						Reel in!
					</button>
				</div>

				<details className="fish-rods" data-testid="fishing-rods">
					<summary>Rods</summary>
					<ul>
						{ownedRods.map((id) => (
							<li key={id}>
								<button
									type="button"
									className={
										id === equippedRod ? "fish-rod fish-rod-active" : "fish-rod"
									}
									data-testid={`fishing-rod-${id}`}
									aria-pressed={id === equippedRod}
									onClick={() => equipRod(id)}
								>
									{RODS[id].name} · Luck {RODS[id].luck}
								</button>
							</li>
						))}
					</ul>
					<p className="fish-hint">
						Buy better rods at the produce market's Rods tab.
					</p>
				</details>

				<section className="fish-creel" data-testid="fishing-creel">
					<h3 className="fish-creel-title">Creel</h3>
					{held.length === 0 ? (
						<p className="fish-hint">Nothing yet — go catch something.</p>
					) : (
						<ul className="fish-creel-list">
							{held.map((id) => (
								<li key={id} data-testid={`fishing-held-${id}`}>
									<span>
										{FISH[id].emoji} {FISH[id].name}
									</span>
									<span>×{fish[id]}</span>
								</li>
							))}
						</ul>
					)}
					<p className="fish-hint">
						Sell your catch on the produce market's Fish tab.
					</p>
				</section>
			</div>
		</div>
	);
}
