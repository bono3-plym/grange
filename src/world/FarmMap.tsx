import * as ex from "excalibur";
import { useEffect, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { logout } from "../auth";
import { emitLeaveFarm, emitVisitFarm } from "../socket";
import { useGameStore } from "../store";
import { FarmMapScene } from "./FarmMapScene";
import "./farmMap.css";
import { MAP_HEIGHT, MAP_WIDTH } from "./mapData";
import { resources } from "./resources";

const TOOLS = [
	{ id: "hoe", label: "Hoe", key: "1" },
	{ id: "seed", label: "Seed", key: "2" },
	{ id: "bucket", label: "Water", key: "3" },
	{ id: "scythe", label: "Harvest", key: "4" },
] as const;

export default function FarmMap() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const username = useGameStore((s) => s.username);
	const farm = useGameStore((s) => s.activeFarm);
	const tool = useGameStore((s) => s.tool);
	const setTool = useGameStore((s) => s.setTool);
	const { owner } = useParams<{ owner?: string }>();
	const navigate = useNavigate();

	const target = owner ?? username;
	const isOwner = target === username;

	useEffect(() => {
		if (!target) return;

		emitVisitFarm(target, (res) => {
			if (!res.ok) navigate("/dashboard", { replace: true });
		});

		return () => emitLeaveFarm();
	}, [target, navigate]);

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

		engine.addScene("farm-map", new FarmMapScene(target, isOwner));
		void Promise.all(resources.map((resource) => resource.load())).then(
			async () => {
				if (cancelled) return;
				await engine.start();
				if (!cancelled) await engine.goToScene("farm-map");
			},
		);

		return () => {
			cancelled = true;
			engine.stop();
			engine.dispose();
		};
	}, [target, isOwner]);

	async function onSignOut() {
		await logout();
		navigate("/", { replace: true });
	}

	return (
		<main className="farm-map-page">
			<canvas
				ref={canvasRef}
				className="farm-map-canvas"
				aria-label="Farm map with buildings, a tilled field, paths, trees, and water"
			/>
			<div className="farm-map-bar">
				<span data-testid="farm-map-owner">
					{isOwner ? "Your farm" : `${target}'s farm`}
				</span>
				<span className="farm-map-user" data-testid="farm-map-user">
					{username}
				</span>
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

			{isOwner && (
				<div className="farm-map-tools">
					{TOOLS.map((entry) => (
						<button
							key={entry.id}
							type="button"
							data-testid={`tool-${entry.id}`}
							onClick={() => setTool(entry.id)}
							className={
								tool === entry.id
									? "farm-map-tool farm-map-tool-active"
									: "farm-map-tool"
							}
						>
							{entry.key} · {entry.label}
						</button>
					))}
					<span className="farm-map-hint">Space to use on your tile</span>
				</div>
			)}
		</main>
	);
}
