import type { MarketItemId } from "./marketData";

interface PurchaseSliderProps {
	id: MarketItemId;
	value: number;
	/** Largest quantity the player can currently buy (affordable + stack cap). */
	max: number;
	price: number;
	disabled: boolean;
	actionLabel: string;
	onChange: (value: number) => void;
	onAction: (quantity: number) => void;
}

/**
 * An incremental slider for buying seeds in bulk. The range snaps to whole
 * units between 1 and `max`, so a single drag sets the exact quantity and the
 * button shows the running total before the player commits.
 */
export function PurchaseSlider({
	id,
	value,
	max,
	price,
	disabled,
	actionLabel,
	onChange,
	onAction,
}: PurchaseSliderProps) {
	return (
		<div className="market-slider">
			<input
				type="range"
				className="market-slider-input"
				min={1}
				max={Math.max(1, max)}
				step={1}
				value={value}
				disabled={disabled}
				onChange={(event) => onChange(Number(event.target.value))}
				aria-label="Quantity"
				data-testid={`market-slider-${id}`}
			/>
			<button
				type="button"
				className="market-item-action"
				data-testid={`market-action-${id}`}
				disabled={disabled}
				onClick={() => onAction(value)}
			>
				{`${actionLabel} ${value} for $${(value * price).toLocaleString()}`}
			</button>
		</div>
	);
}
