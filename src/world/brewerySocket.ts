import type { BreweryAction, BreweryStatus } from "../../shared/types";
import { type Ack, farmChannelFor, reasonOf } from "../socket";

/** Reply to a brewery insert/remove/start action. */
export interface BreweryAck extends Ack {
	brewery?: BreweryStatus | null;
	barn?: Record<string, number>;
}

/** Owner-only brewery controls: insert 10 crops, remove them, or start a batch. */
export function emitBreweryAction(
	owner: string,
	action: BreweryAction,
	cb?: (res: BreweryAck) => void,
): void {
	const channel = farmChannelFor(owner);
	if (!channel) {
		cb?.({ ok: false, error: "not visiting farm" });
		return;
	}

	channel
		.push("breweryAction", { action })
		.receive("ok", (payload: unknown) => {
			const data = (payload ?? {}) as {
				brewery?: BreweryStatus | null;
				barn?: Record<string, number>;
			};
			cb?.({ ok: true, ...data });
		})
		.receive("error", (payload: unknown) =>
			cb?.({ ok: false, error: reasonOf(payload) ?? "Brewery action failed" }),
		)
		.receive("timeout", () => cb?.({ ok: false, error: "Timed out" }));
}
