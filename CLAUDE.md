# CLAUDE.md

Guidance for Claude Code (and any coding agent) working in this repository.

## What this is

**Home Management** — a self-hosted, Sweepy-style chore app built as an installable
**PWA** (no native iOS app). The household sets up their home (Kitchen, Bedroom 1,
Bedroom 2, Bathroom 1…), each room gets recurring chores, every chore's "dirtiness"
creeps up between cleanings, the Today list shows what's due, completing a chore earns
points on a household leaderboard, and the server sends **Web Push reminders**.

Owner's requirements (keep honoring these):
- Replicate the *concept* of Sweepy for personal use — own code, own server, no third-party accounts.
- PWA installed via Safari "Add to Home Screen"; must work offline.
- Hosted on the owner's private home server, same pattern as `C:\Sandbox\Tracker`
  (one Docker container, SQLite volume, tailnet-only).
- **Served over plain HTTP at the server's Tailscale IP** (`http://100.x.y.z:40001`) —
  the owner chose not to use HTTPS. That page is *not* a secure context, so: no
  service worker (no offline), no Web Push, no `crypto.randomUUID` (see `newId`).
  Code must keep working without those APIs; push/offline light up only if HTTPS
  is added later (deploy.md §8: `tailscale serve --https=40443 localhost:40001`,
  a dedicated port so the server's other apps/ports are untouched).
- **Host port is 40001** (owner's choice): `APP_PORT` in `.env`, defaulted in
  `docker-compose.yml` and `.env.example`. The container listens on 8080 internally.
- GitHub repo `TanayaBhave/Home_Management` is **private**.

## Commands

```bash
npm run dev       # Vite dev server :5173 (proxies /api → 127.0.0.1:8080)
npm run build     # tsc -b (app + sw + node configs) + vite build → dist/
npm run lint      # oxlint
npm test          # Playwright smoke tests against `npm run preview` (:4173), iPhone 13 emulation
npm run icons     # regenerate public/*.png icons (dependency-free script)

# Server locally (needs a build copied to server/public for the UI):
cd server && npm install
SYNC_TOKEN=dev PORT=8080 DB_PATH=./dev.sqlite node index.js
```

Playwright is pinned (exact version) to match the browsers already installed on this
machine — bump it together with `npx playwright install`.

## Architecture

Local-first: Dexie (IndexedDB) is the on-device source of truth; the server is a
sync hub + reminder sender. Same sync design as the Tracker project.

### Client (`src/`)
- [src/db.ts](src/db.ts) — types + Dexie schema (`members`, `rooms`, `tasks`, `completions`), `SYNC_TABLES`, helpers, device-local "who am I".
- [src/chores.ts](src/chores.ts) — pure scheduling math: `dirtiness`, `dueDate`, `isDue`, `cleanliness`, effort→points, frequency presets.
- [src/templates.ts](src/templates.ts) — room kinds (emoji/labels), starter chores per kind, `setupHome`, `createRoom`, `addMember`.
- [src/actions.ts](src/actions.ts) — multi-table writes: complete/undo, delete room (cascades tasks), delete member.
- [src/hooks.ts](src/hooks.ts) — `useLiveQuery` hooks + `useNow` (minute ticker).
- [src/sync.ts](src/sync.ts) — sync engine (copied from Tracker): push dirty rows by `updatedAt`, pull by server cursor, LWW.
- [src/push.ts](src/push.ts) — Web Push subscribe/unsubscribe/test + per-device prefs (digest time, scope).
- [src/sw.ts](src/sw.ts) — custom service worker (injectManifest): precache, SPA fallback, `push` + `notificationclick`.
- [src/App.tsx](src/App.tsx) — tabs Today / Rooms / Scores / Settings; first-run `SetupSheet`; global `TaskSheet`.
- `src/components/` — screens and sheets; `Bits.tsx` has shared Field/ChipSelect/Avatar/DirtMeter/CleanRing; `Sheet.tsx` is the bottom sheet.

### Server (`server/`, plain ESM, no build step)
- `index.js` — Fastify; registers routes, serves `./public` (built PWA) with SPA fallback, starts reminders.
- `db.js` — SQLite (better-sqlite3, WAL): `records` (generic synced rows), `meta`, `push_subs`, `push_sent`.
- `sync.js` — `POST /api/sync`, `GET /api/health`, shared `authorized()` bearer check. **`SYNC_TABLES` must match `src/db.ts`.**
- `push.js` — VAPID keys (env or auto-generated + stored in `meta`), `/api/push/{key,subscribe,unsubscribe,test}`.
- `reminders.js` — 60 s tick: per subscription, in *its* timezone, send the daily digest and per-task `remindAt` reminders once (deduped via `push_sent`, 2 h grace after downtime).

## Conventions
- Every synced record has `id`, `createdAt`, `updatedAt`, `deleted` (0|1). **Every write must bump `updatedAt`** (use `touch`/`softDelete` or set it explicitly) or it won't sync.
- Booleans that might be indexed are `0 | 1` numbers (Dexie can't index booleans): `deleted`, `archived`.
- Never hard-delete synced rows — soft delete so the tombstone replicates.
- Dirtiness is derived, not stored: `(now - lastDoneAt) / freqDays`. The slider writes `lastDoneAt`. `server/reminders.js` re-implements `isDue` — change both together.
- Device-local settings live in `localStorage` (never synced): `meMemberId`, `syncUrl`, `syncToken`, `pushDigestTime`, `pushScope`, sync cursors.
- Adding a synced table: add to Dexie schema (new `version()`), `SYNC_TABLES` in **both** `src/db.ts` and `server/sync.js`.
- Match the existing style: function components, no state library, plain CSS in `src/index.css` with CSS variables (light + `prefers-color-scheme: dark`).

## iOS PWA notes
- Service worker + push need HTTPS; over the plain-HTTP tailnet URL they're unavailable (Add to Home Screen still works).
- Web Push on iPhone requires iOS 16.4+ **and** the app opened from the Home Screen icon; permission must be requested from a tap (Settings → Turn on reminders).
- iOS may evict IndexedDB for un-installed sites; server sync is the durability guarantee.

## Deploy
See [deploy.md](deploy.md).
