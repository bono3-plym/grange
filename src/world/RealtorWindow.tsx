import { useEffect } from "react";
import { Hotbar } from "../inventory/Hotbar";
import { ITEMS } from "../inventory/items";
import {
	MATERIAL_ITEMS,
	type MaterialItemId,
} from "../inventory/materialItems";
import { BREWERY } from "./realtorData";
import { useEconomyBalance } from "./useEconomy";
import "./realtor.css";

interface RealtorWindowProps {
	owned: boolean;
	materials: Record<MaterialItemId, number>;
	busy: boolean;
	message: string | null;
	onBuild: () => void;
	onClose: () => void;
}

/** The realtor's listing window: requirements and the brewery build action. */
export function RealtorWindow({
	owned,
	materials,
	busy,
	message,
	onBuild,
	onClose,
}: RealtorWindowProps) {
	const balance = useEconomyBalance();

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

	const canAfford = balance >= BREWERY.price;
	const hasMaterials = MATERIAL_ITEMS.every(
		(id) => materials[id] >= BREWERY.materials[id],
	);
	const canBuild = !owned && !busy && canAfford && hasMaterials;

	return (
		<div className="market-overlay">
			<div
				className="market-window realtor-window"
				role="dialog"
				aria-modal="true"
				aria-label="Realtor listings"
				data-testid="realtor-window"
			>
				<header className="market-header">
					<h2 className="market-title">REALTOR · PROPERTY LOT</h2>
					<span className="market-balance" data-testid="realtor-balance">
						<span className="market-coin" aria-hidden="true">
							🪙
						</span>
						BALANCE: {balance.toLocaleString()} GC
					</span>
					<button
						type="button"
						className="market-close"
						data-testid="realtor-close"
						aria-label="Close realtor"
						onClick={onClose}
						disabled={busy}
					>
						×
					</button>
				</header>

				<div className="market-body">
					<div className="realtor-body">
						<div className="realtor-showcase">
							<img
								className="realtor-brewery"
								src="/assets/marketplace/realtor/brewery.png"
								alt="Brewery blueprint"
								draggable={false}
							/>
							{owned && (
								<span className="realtor-built" data-testid="realtor-built">
									BUILT
								</span>
							)}
						</div>

						<div className="realtor-listing">
							<p className="realtor-kicker">FOR SALE · BUILDING LOT</p>
							<h3 className="realtor-name">{BREWERY.name}</h3>
							<p className="realtor-blurb">{BREWERY.blurb}</p>

							<ul className="realtor-requirements" aria-label="Requirements">
								{MATERIAL_ITEMS.map((id) => {
									const need = BREWERY.materials[id];
									const have = materials[id];
									return (
										<li
											key={id}
											className={have >= need ? "realtor-met" : ""}
											data-testid={`realtor-require-${id}`}
										>
											<img src={ITEMS[id].icon} alt="" aria-hidden="true" />
											<span>{ITEMS[id].name}</span>
											<strong>
												{have}/{need}
											</strong>
										</li>
									);
								})}
								<li
									className={canAfford ? "realtor-met" : ""}
									data-testid="realtor-require-coin"
								>
									<span className="realtor-coin" aria-hidden="true">
										🪙
									</span>
									<span>Grangecoin</span>
									<strong>
										{balance.toLocaleString()}/{BREWERY.price.toLocaleString()}
									</strong>
								</li>
							</ul>

							<button
								type="button"
								className="realtor-build"
								data-testid="realtor-build"
								disabled={!canBuild}
								onClick={onBuild}
							>
								{owned
									? "Brewery built"
									: busy
										? "Building…"
										: `Build ${BREWERY.name} · ${BREWERY.price.toLocaleString()} GC`}
							</button>
						</div>
					</div>
				</div>

				{message && (
					<p className="market-message" data-testid="realtor-message">
						{message}
					</p>
				)}

				<footer className="market-footer">
					<span className="market-keyhint">[ESC] Close</span>
					<div className="market-footer-hotbar">
						<Hotbar />
					</div>
					<span className="market-keyhint">Property Lot</span>
				</footer>
			</div>
		</div>
	);
}
