import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cwd = resolve(root, "backend");
const args = process.argv.slice(2);

const direct = spawnSync("mix", args, { cwd, stdio: "inherit" });
if (direct.error?.code !== "ENOENT") {
	process.exit(direct.status ?? 1);
}

const viaMise = spawnSync("mise", ["x", "--", "mix", ...args], {
	cwd,
	stdio: "inherit",
});
if (viaMise.error?.code === "ENOENT") {
	console.error("Could not find mix or mise. Install Elixir or mise first.");
}
process.exit(viaMise.status ?? 1);
