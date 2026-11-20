import { useEffect, useState } from "react";
import { CROPS } from "../../shared/crops";
import type { BreweryStatus } from "../../shared/types";
import type { ItemId } from "../inventory/items";
import { ITEMS } from "../inventory/items";
import {
	BREW_BATCH_SIZE,
	BREW_CROP_ORDER,
	BREW_EXPLANATION,
	BREW_HOUR_MS,
	BREW_RECIPES,
	formatBrewCountdown,
} from "./breweryData";
import "./brewery.css";

interface BreweryWindowProps {
	brewery: BreweryStatus | null;
	barn: Record<string, number>;
	message: string | null;
	busy: boolean;
	onInsert: (item: string) => void;
	onRemove: () => void;
	onStart: () => void;
	onClose: () => void;
}

function defOf(id: string | null | undefined) {
	return id ? ITEMS[id as ItemId] : null;
}

/** The brewery screen: choose 10 crops, start a batch, and watch the timer. */
export function BreweryWindow({
	brewery,
	barn,
	message,
	busy,
	onInsert,
	onRemove,
	onStart,
	onClose,
}: BreweryWindowProps) {
	const [now, setNow] = useState(Date.now());

	useEffect(() => {
		if (brewery?.status !== "brewing") return;
		const timer = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(timer);
	}, [brewery?.status]);

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if (event.repeat || busy) return;
			if (event.code === "Escape" || event.code === "KeyE") {
				event.preventDefault();
				event.stopImmediatePropagation();
				onClose();
			}
		}
		window.addEventListener("keydown", onKeyDown, true);
		return () => window.removeEventListener("keydown", onKeyDown, true);
	}, [busy, onClose]);

	const inputDef = defOf(brewery?.input_item);
	const outputDef = defOf(brewery?.output_item);
	const lastDef = defOf(brewery?.last_output);
	const brewing = brewery?.status === "brewing";
	const total = brewery?.started_at && brewery.ready_at
		? Math.max(1, brewery.ready_at - brewery.started_at)
		: BREW_HOUR_MS;
	const remaining = brewery?.ready_at ? Math.max(0, brewery.ready_at - now) : 0;
	const progress = brewing ? Math.min(1, Math.max(0, (total - remaining) / total)) : 0;

	return (
		<div className="market-overlay">
			<div
				className="market-window brewery-window"
				role="dialog"
				aria-modal="true"
				aria-label="Brewery"
				data-testid="brewery-window"
			>
				<header className="market-header">
					<h2 className="market-title">BREWERY</h2>
					<button
						type="button"
						className="market-close"
						data-testid="brewery-close"
						aria-label="Close brewery"
						onClick={onClose}
						disabled={busy}
					>
						×
					</button>
				</header>

				<div className="market-body">
					<div className="brewery-body">
						<div className="brewery-showcase">
							<img
								className="brewery-art"
								src="/assets/marketplace/realtor/brewery.png"
								alt="Brewery"
								draggable={false}
							/>
						</div>

						<div className="brewery-panel">
							{!brewery && (
								<p className="brewery-copy">
									Build a brewery from the realtor before you can brew.
								</p>
							)}

							{brewery && brewing && (
								<section className="brewery-batch" data-testid="brewery-batch">
									<p className="brewery-kicker">BATCH IN PROGRESS</p>
									<div className="brewery-row">
										{inputDef && <img src={inputDef.icon} alt="" />}
										<span>
											10 {inputDef?.name ?? brewery.input_item} →{" "}
											{outputDef?.name ?? brewery.output_item}
										</span>
									</div>
									<p className="brewery-timer" data-testid="brewery-timer">
										{remaining <= 0
											? "Ready…"
											: formatBrewCountdown(remaining)}
									</p>
									<div className="brewery-progress" aria-hidden="true">
										<span style={{ width: `${progress * 100}%` }} />
									</div>
									<p className="brewery-hint">
										The finished batch goes straight to your barn.
									</p>
								</section>
							)}

							{brewery && !brewing && brewery.input_item && (
								<section className="brewery-batch" data-testid="brewery-ready">
									<p className="brewery-kicker">READY TO START</p>
									<div className="brewery-row">
										{inputDef && <img src={inputDef.icon} alt="" />}
										<span>
											{brewery.input_count} {inputDef?.name ?? brewery.input_item} →{" "}
											{outputDef?.name ?? brewery.output_item}
										</span>
									</div>
									<div className="brewery-actions">
										<button
											type="button"
											className="brewery-primary"
											data-testid="brewery-start"
											disabled={busy}
											onClick={onStart}
										>
											{busy ? "Starting…" : "Start brew"}
										</button>
										<button
											type="button"
											className="brewery-secondary"
											data-testid="brewery-remove"
											disabled={busy}
											onClick={onRemove}
										>
											Take back crops
										</button>
									</div>
								</section>
							)}

							{brewery && !brewing && !brewery.input_item && (
								<section className="brewery-picker">
									<p className="brewery-kicker">FILL THE MASH TUN</p>
									<p className="brewery-copy">{BREW_EXPLANATION}</p>
									<div className="brewery-crops">
										{BREW_CROP_ORDER.map((crop) => {
											const recipe = BREW_RECIPES[crop];
											const count = barn[crop] ?? 0;
											const allowed = Boolean(recipe);
											const enough = count >= BREW_BATCH_SIZE;
											const disabled = busy || (allowed && !enough);
											const output = recipe ? defOf(recipe) : null;
											return (
												<button
													key={crop}
													type="button"
													className={`brewery-crop${allowed ? "" : " brewery-crop-rejected"}`}
													data-testid={`brewery-crop-${crop}`}
													disabled={disabled}
													onClick={() => onInsert(crop)}
												>
													<img
														src={`/assets/crops/${CROPS[crop].harvested}`}
														alt=""
														aria-hidden="true"
													/>
													<span className="brewery-crop-name">
														{CROPS[crop].name}
													</span>
													<span className="brewery-crop-stock">
														Barn: {count}
													</span>
													<span className="brewery-crop-note">
														{allowed
															? enough
																? `10 → ${output?.name}`
																: "Need 10"
															: "Not accepted"}
													</span>
												</button>
											);
										})}
									</div>
								</section>
							)}

							{lastDef && (
								<p className="brewery-last" data-testid="brewery-last-output">
									Last batch: {lastDef.name} added to your barn.
								</p>
							)}
						</div>
					</div>
				</div>

				{message && (
					<p className="market-message" data-testid="brewery-message">
						{message}
					</p>
				)}

				<footer className="market-footer">
					<span className="market-keyhint">[ESC] Close</span>
					<span className="market-keyhint">One hour per batch</span>
				</footer>
			</div>
		</div>
	);
}
