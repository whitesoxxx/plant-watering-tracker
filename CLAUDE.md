# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
node server.js        # start the server (http://localhost:3000)
npm install           # install dependencies after cloning
```

No build step, no test runner, no linter configured.

## Architecture

Single-file Express backend (`server.js`) serving a plain HTML/CSS/JS frontend from `public/`.

**Backend (`server.js`)**
- SQLite database (`plants.db`) via `better-sqlite3` — synchronous API, no async/await needed
- DB tables created at startup with `CREATE TABLE IF NOT EXISTS`
- `computeStatus(plant, lastWatered)` is the only business logic function — it derives `next_due` and `is_overdue` at query time from `MAX(watered_at)`, never stored in the DB
- All routes are under `/api`; `express.static('public')` serves the frontend

**Frontend (`public/`)**
- Single-page app with three panels toggled via `.hidden` CSS class: dashboard (card grid), add-plant form overlay, history panel
- `fetchAndRender()` in `app.js` is the sole render function — it fetches `/api/plants`, sorts (overdue first, then by `next_due`), and rebuilds the grid with template literals
- Card button clicks use event delegation on `#plant-grid` via `data-action` attributes (`water`, `history`, `remove`)
- Auto-refreshes every 60 seconds via `setInterval`

**Data flow for overdue detection:** `GET /api/plants` LEFT JOINs `watering_logs` to get `MAX(watered_at)` per plant, then `computeStatus` compares `last_watered + water_every_days` against the current time in JS. Plants never watered have `last_watered: null` and are always `is_overdue: true`.

## Key Constraints

- `better-sqlite3` requires the Windows SDK and MSVC build tools to compile its native addon — both are installed on this machine
- `plants.db` is gitignored (user data stays local)
- After completing any feature or fix, commit and push to `origin/main`
