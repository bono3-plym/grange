import * as ex from "excalibur";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { FarmToolId } from "../../shared/farm";
import { logout } from "../auth";
import { emitLeaveFarm, emitSellTomatoes, emitVisitFarm } from "../socket";
import { useGameStore } from "../store";
import { CasinoScene } from "./CasinoScene";
import { casinoResources } from "./casinoResources";
import { EconomyHUD } from "./EconomyHUD";
import { economy } from "./EconomyManager";
import { FarmMapScene } from "./FarmMapScene";
import type { FarmHudSnapshot } from "./farmHud";
import "./farmMap.css";
import { MAP_HEIGHT, MAP_WIDTH } from "./mapData";
import {
	MARKET_ITEMS,
	MARKETS,
	type MarketId,
	type MarketItemId,
} from "./marketData";
import { MarketplaceScene } from "./MarketplaceScene";
import { marketplaceResources } from "./marketplaceResources";
import { MarketWindow, type MarketItemControl } from "./MarketWindow";
import { resources } from "./resources";
import { useEconomyBalance } from "./useEconomy";
import type { WorldArea } from "./WalkingScene";

const worldResources = [
	...new Set([...resources, ...marketplaceResources, ...casinoResources]),
];

const TOOLS: Array<{ id: FarmToolId; label: string; key: string }> = [
	{ id: "hoe", label: "Hoe", key: "1" },
	{ id: "seed", label: "Seeds", key: "2" },
	{ id: "bucket", label: "Bucket", key: "3" },
	{ id: "scythe", label: "Scythe", key: "4" },
];

const TOOL_BY_KEY: Record<string, FarmToolId> = {
	Digit1: "hoe",
	Digit2: "seed",
	Digit3: "bucket",
	Digit4: "scythe",
	Numpad1: "hoe",
	Numpad2: "seed",
	Numpad3: "bucket",
	Numpad4: "scythe",
};

export default function FarmMap() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const sceneRef = useRef<FarmMapScene | null>(null);
	const marketSceneRef = useRef<MarketplaceScene | null>(null);
	const username = useGameStore((s) => s.username);
	const farm = useGameStore((s) => s.activeFarm);
	const tool = useGameStore((s) => s.tool);
	const setTool = useGameStore((s) => s.setTool);
	const tomatoSeeds = useGameStore((s) => s.tomatoSeeds);
	const addTomatoSeeds = useGameStore((s) => s.addTomatoSeeds);
	const balance = useEconomyBalance();
	const { owner } = useParams<{ owner?: string }>();
	const navigate = useNavigate();
	const [hud, setHud] = useState<FarmHudSnapshot>({
		tomatoes: 0,
		message: "Hoe: click or drag on grass to till.",
		hovered: null,
	});
	const [market, setMarket] = useState<MarketId | null>(null);
	const [marketMessage, setMarketMessage] = useState<string | null>(null);

	const target = owner ?? username;
	const isOwner = target === username;

	useEffect(() => {
		if (!target) return;

		emitVisitFarm(target, (res) => {
			if (!res.ok) navigate("/dashboard", { replace: true });
		});

		return () => emitLeaveFarm();
	}, [target, navigate]);
	const [area, setArea] = useState<WorldArea>("Farm");
	const [travelPrompt, setTravelPrompt] = useState<string | null>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas || !target) return;

		let cancelled = false;
		const engine = new ex.Engine({
			canvasElement: canvas,
			viewport: { width: MAP_WIDTH, height: MAP_HEIGHT },
			resolution: { width: MAP_WIDTH, height: MAP_HEIGHT },
			displayMode: ex.DisplayMode.FitContainer,
			pixelArt: true,
			suppressConsoleBootMessage: true,
			backgroundColor: ex.Color.fromHex("#79a44d"),
		});

		const scene = new FarmMapScene(target, isOwner, setTravelPrompt, setArea);
		scene.onFarmUpdate = (snapshot) => setHud(snapshot);
		sceneRef.current = scene;
		engine.addScene("farm-map", scene);
		const marketplace = new MarketplaceScene(
			setTravelPrompt,
			setArea,
			(id) => {
				setMarketMessage(null);
				setMarket(id);
			},
		);
		marketSceneRef.current = marketplace;
		engine.addScene("marketplace", marketplace);
		engine.addScene("casino", new CasinoScene(setTravelPrompt, setArea));
		void Promise.all(worldResources.map((resource) => resource.load())).then(
			async () => {
				if (cancelled) return;
				await engine.start();
				if (!cancelled) await engine.goToScene("farm-map");
			},
		);

		return () => {
			cancelled = true;
			sceneRef.current = null;
			marketSceneRef.current = null;
			engine.stop();
			engine.dispose();
		};
	}, [target, isOwner]);

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			const next = TOOL_BY_KEY[event.code];
			if (next) setTool(next);
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [setTool]);

	useEffect(() => {
		sceneRef.current?.setTool(tool);
	}, [tool]);

	function closeMarket() {
		setMarket(null);
		setMarketMessage(null);
		marketSceneRef.current?.setPaused(false);
	}

	function buyTomatoSeeds() {
		const item = MARKET_ITEMS["tomato-seed"];
		const result = economy.buy(item.price);
		if (!result.success) {
			setMarketMessage(result.error ?? "Purchase failed.");
			return;
		}
		addTomatoSeeds(item.quantity);
		setMarketMessage(
			`Bought ${item.quantity} tomato seeds for $${item.price}.`,
		);
	}

	function sellTomato(quantity: number) {
		if (!target || quantity < 1) return;
		const item = MARKET_ITEMS.tomato;
		emitSellTomatoes(target, quantity, (res) => {
			if (!res.ok) {
				setMarketMessage(res.error ?? "Sale failed.");
				return;
			}
			economy.sell(item.price * quantity);
			const noun = quantity === 1 ? "tomato" : "tomatoes";
			setMarketMessage(
				`Sold ${quantity} ${noun} for $${item.price * quantity}.`,
			);
		});
	}

	const itemControls: Record<MarketItemId, MarketItemControl> = {
		"tomato-seed": {
			owned: tomatoSeeds,
			disabled: balance < MARKET_ITEMS["tomato-seed"].price,
			actionLabel: "Buy",
			onAction: buyTomatoSeeds,
		},
		tomato: {
			owned: farm?.tomatoes ?? 0,
			disabled: !isOwner || (farm?.tomatoes ?? 0) < 1,
			actionLabel: "Sell",
			maxQuantity: farm?.tomatoes ?? 0,
			onAction: sellTomato,
		},
	};

	async function onSignOut() {
		await logout();
		navigate("/", { replace: true });
	}

	return (
		<main className="farm-map-page">
			<canvas
				ref={canvasRef}
				className="farm-map-canvas"
				aria-label={`${area} map. Use WASD or arrow keys to walk.`}
			/>
			{market && (
				<MarketWindow
					market={MARKETS[market]}
					controls={itemControls}
					message={marketMessage}
					onClose={closeMarket}
				/>
			)}
			{travelPrompt && (
				<div className="farm-map-travel-prompt" data-testid="travel-prompt">
					{travelPrompt}
				</div>
			)}
			<div className="farm-map-bar">
				<span data-testid="farm-map-owner">
					{isOwner ? "Your farm" : `${target}'s farm`}
				</span>
				<span className="farm-map-user" data-testid="farm-map-user">
					{username}
				</span>
				<EconomyHUD />
				<span data-testid="farm-map-tomatoes">
					{farm?.tomatoes ?? 0} tomatoes
				</span>
				<span data-testid="farm-map-tiles">
					{farm?.tiles.length ?? 0} tiles
				</span>
				<Link to="/dashboard" className="farm-map-signout">
					Dashboard
				</Link>
				<button
					type="button"
					data-testid="logout"
					onClick={onSignOut}
					className="farm-map-signout"
				>
					Sign out
				</button>
			</div>
			{area === "Farm" && (
				<div className="farm-hud" data-testid="farm-hud">
					{isOwner ? (
						<div
							className="farm-tools"
							role="toolbar"
							aria-label="Farming tools"
						>
							{TOOLS.map((entry) => (
								<button
									key={entry.id}
									type="button"
									data-testid={`tool-${entry.id}`}
									aria-pressed={tool === entry.id}
									className={
										tool === entry.id
											? "farm-tool farm-tool-active"
											: "farm-tool"
									}
									onClick={() => setTool(entry.id)}
								>
									<span className="farm-tool-key">{entry.key}</span>{" "}
									{entry.label}
								</button>
							))}
						</div>
					) : null}
					<div className="farm-status">
						<span data-testid="farm-tomatoes">🍅 {hud.tomatoes}</span>
						<span data-testid="farm-tile">
							{hud.hovered
								? `(${hud.hovered.column}, ${hud.hovered.row}): ${hud.hovered.state}`
								: "—"}
						</span>
					</div>
					<p className="farm-hint" data-testid="farm-hint">
						{hud.message}
					</p>
				</div>
			)}
		</main>
	);
}
