---
name: verify
description: Run this repo's exact verification steps (unit tests, type-checks, optional Playwright e2e) before declaring a change to game123 done. Use after implementing or fixing anything in client/server/shared.
---

Run these steps in order and report pass/fail for each. Stop and fix before moving to the next step only if a step's failure would make later steps meaningless (e.g. a type error usually still lets tests run — run everything and report all failures together).

1. **Unit tests** — `npm test` (repo root). Runs `shared` and `server`'s `node --import tsx --test` suites. This does NOT include the client or e2e.
2. **Type-check** — `npm run build` (repo root). This type-checks `server` (`tsc --noEmit`, no emit) and builds `client` (`tsc && vite build`). A failure here is a real type error, not a missed build step.
3. **E2E (only if the change touches gameplay behavior, Socket.IO events, or UI in `client/` or `server/src/sockets|rooms`)** — `npx playwright test` from repo root. `playwright.config.ts` auto-starts both the server (`:3001`) and client (`:5173`); do not start them manually first. For deterministic ghost-timing assertions, specs rely on the server picking up `GHOST_TEST_SEED` — set it in the environment before running if a spec needs reproducible ghost turns:
   - PowerShell: `$env:GHOST_TEST_SEED = "1"; npx playwright test`
   - bash: `GHOST_TEST_SEED=1 npx playwright test`
   Never set `GHOST_TEST_SEED` when running the dev server for real use.

Skip step 3 for changes confined to docs, scripts, or non-gameplay tooling.

4. **Lint** — `npm run lint` (repo root, ESLint flat config). Only check files you actually touched; the pre-existing codebase was never reformatted for Prettier, so `npm run format:check` fails repo-wide on old files by design — don't treat that as a regression, and don't run `npm run format` across the whole repo.
