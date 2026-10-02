# Grange

A small farming game. The frontend is a React/Vite SPA; the backend is
Elixir/Phoenix and talks to the SPA exclusively over Phoenix Channels.

## How to run this

1. Install <https://mise.jdx.dev/>
2. Install the toolchains (Node, pnpm, Erlang, Elixir): `mise install`
3. Install dependencies: `pnpm setup`
4. Run the dev servers: `pnpm dev`

Then visit <http://localhost:3000/>. In development Vite serves the SPA on 3000
and proxies `/socket` and `/api` to Phoenix on 3200.

## Tests

- `pnpm test:backend` — Elixir unit + channel tests (ExUnit)
- `pnpm lint:backend` — Elixir formatting check + Credo (strict)
- `pnpm test:e2e` — Playwright e2e (builds the SPA, then Phoenix serves it)
- `pnpm check` — JS lint, unit tests, backend tests, and build

## Deploy

CI builds a Mix release (with the built SPA in `priv/static`) and syncs it to
the host, where systemd runs it. See `deploy/` for the unit and deploy script.