# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"123 木頭人"(Red Light, Green Light)— a 3D multiplayer party game. Players use their phones as controllers; a host device shows a bird's-eye 3D control console. See `README.md` for the full game rules, Socket.IO event protocol table, and Playwright E2E instructions.

## Monorepo layout

npm workspaces: `client`, `server`, `shared`.

- `client/` — Vite + TypeScript + Three.js. Two entry points: `player.html`/`main-player.ts` (phone player view) and `host.html`/`main-host.ts` (host console).
- `server/` — Express + Socket.IO backend. `src/index.ts` (entry, static file serving + global tick loop), `src/rooms/` (`GameRoom.ts`, `RoomManager.ts`), `src/sockets/` (handlers, broadcast).
- `shared/` — framework-free logic/types imported directly as TS source by both client and server (no build step, `exports` points at `src/index.ts`).
- `e2e/` — Playwright specs.
- `scripts/load-test.mjs` — socket.io-client based load/stress test.

## Commands

Run from repo root unless noted:

- `npm run dev` — starts server (`:3001`) and client (`:5173`) concurrently.
- `npm run build` — type-checks server (`tsc --noEmit`, no emit) and builds the client (`tsc && vite build`).
- `npm test` — runs `shared` and `server` unit tests only (Node's built-in `node --import tsx --test`, not Jest/Vitest). Does **not** run Playwright e2e.
- `npx playwright test` — runs the e2e suite in `e2e/`; `playwright.config.ts` auto-starts both server and client for the run.
- `npm run lint` — ESLint (flat config at `eslint.config.mjs`, root-level, covers all workspaces).
- `npm run format` / `npm run format:check` — Prettier, default rules (`.prettierrc.json` is intentionally empty).
- The pre-existing codebase was NOT reformatted when Prettier was added, so `format:check` currently fails repo-wide on old files — this is expected, not a regression. Don't run `npm run format` across the whole repo as a side effect of an unrelated change; only format files you're already touching.

## Server-authoritative game logic

All judging happens server-side; clients only send intent. Notable non-obvious patterns in `server/src/rooms/GameRoom.ts` and `shared/src/config.ts`:

- **Single global tick loop**: one `setInterval` at `SERVER_TICK_MS` (100ms) in `server/src/index.ts` calls `roomManager.tickAll(now)` for every room — rooms do not have their own timers.
- **`now` is always injected**, never read internally via `Date.now()` inside `GameRoom` — this is deliberate for testability (see `GameRoom.test.ts`). Preserve this when adding new time-based logic.
- **Boost RNG and Ghost RNG are separate injected functions** in the `GameRoom` constructor, kept decoupled so their randomness doesn't interfere and each can be unit tested independently.
- **State machine**: `WAITING → PLAYING → GAME_OVER`, with `PAUSED` reachable only from `PLAYING`. On resume, every time-based field (ghost clock, round deadline, per-player boost timers) is shifted forward by the paused duration — a new timed field must be added to this shift or pausing will desync it.
- **`updateSettings` only allowed in `WAITING` phase** — rejects mid-game setting changes to avoid inconsistent per-player state. Host-submitted `RoomSettings` are never trusted as-is: `normalizeRoomSettings()` in `shared/src/config.ts` clamps/validates against fixed option lists.
- **Reconnection** uses a persistent `playerId`/`hostId` stored in client `localStorage`, decoupled from Socket.IO's own `socket.id` (which changes every reconnect). `RECONNECT_GRACE_MS` (30s) elapses before a disconnected player is eliminated.
- **Two ghost classes**: `GhostAI` (server-authoritative, real RNG) vs `GhostReplicaAI` (client-only, driven purely by broadcast events) — never use the client replica for judging anything.
- **`GHOST_TEST_SEED` env var**: when set, replaces `Math.random()` with a seeded xorshift32 PRNG for deterministic E2E ghost timing. Must never be set in production.
- **`PORT` env var** defaults to 3001; Render (see `render.yaml`) injects this automatically.
- The server serves the client's static build directly (`client/dist`, resolved relative to the compiled server output) with route rewrites for `/`, `/host`, `/join/:code` — the client must be built before the server can serve a working app.
