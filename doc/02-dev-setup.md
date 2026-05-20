# Development Setup

## Prerequisites

| Requirement | Minimum | Notes |
|---|---|---|
| Bun | 1.3+ | Runtime, package manager, API server, SQLite access |
| macOS | Required only for DMG packaging | `iconutil` is used for `.icns` generation |
| Node.js | Not required directly | Some tooling is executed through Bun/npm packages |

Install Bun:

```bash
curl -fsSL https://bun.sh/install | bash
bun --version
```

## Install Dependencies

```bash
bun install
```

This installs React, Vite, Tailwind CSS, shadcn/ui dependencies, lucide icons, Electron, electron-builder, and packaging helpers.

## Recommended Local Startup

Use the helper script to run the full development app in the background:

```bash
./start.sh
# or
bun run app:start
```

The script:

- creates `.runtime/` and `logs/`
- starts `bun run dev:api` on `http://localhost:3000`
- starts `bun dev` on `http://localhost:5173`
- writes PID files to `.runtime/api.pid` and `.runtime/frontend.pid`
- writes logs to `logs/api.log` and `logs/frontend.log`
- waits until both services are reachable

Stop both processes:

```bash
./stop.sh
# or
bun run app:stop
```

`stop.sh` stops tracked child process trees. If PID files are absent but the standard ports are reachable, it uses `lsof` when available to find the listening process.

## Manual Startup

Run the frontend and API in separate terminals:

```bash
bun dev
```

```bash
bun run dev:api
```

Expected URLs:

- Frontend: `http://localhost:5173/`
- API health route: `http://localhost:3000/api/lists`

Vite proxies `/api` requests to the Bun API server.

## Available Scripts

| Script | Command | Description |
|---|---|---|
| `dev` | `vite --host 0.0.0.0` | Frontend dev server with React Fast Refresh |
| `dev:api` | `bun --hot src/index.ts` | Bun API server with hot reload |
| `app:start` | `./start.sh` | Start frontend and API in the background |
| `app:stop` | `./stop.sh` | Stop frontend and API background processes |
| `clean` | `rimraf dist build release .runtime logs` | Remove generated build/runtime artifacts without deleting SQLite data |
| `build` | `vite build` | Build frontend into `dist/` |
| `start` | `NODE_ENV=production bun src/index.ts` | Production API/static server |
| `preview` | `vite preview --host 0.0.0.0` | Preview the static frontend build only |
| `package:mac` | `node scripts/build-macos-dmg.mjs` | Build a macOS DMG with Electron |

## Project Structure

```text
src/
  index.ts              Server entry, routes, SQLite schema/migrations
  frontend.tsx          React entrypoint
  App.tsx               Root component
  TodoApp.tsx           Board UI and app behavior
  index.css             App-level CSS imports and scrollbar/reduced-motion rules
  components/ui/        shadcn/ui primitives
  lib/utils.ts          Shared utilities

electron/
  main.cjs              Electron main process

scripts/
  build-macos-dmg.mjs   macOS package build script

assets/
  app-icon.svg          Source icon for macOS packaging
```

## Development Data

The Bun server creates `data/todos.sqlite` automatically and seeds one example board when no lists exist. To use another data directory:

```bash
TODO_APP_DATA_DIR=/tmp/todo-data bun run dev:api
```

## Testing API Routes

```bash
curl http://localhost:3000/api/lists

curl -X POST http://localhost:3000/api/lists \
  -H "Content-Type: application/json" \
  -d '{"name":"Projekt"}'

curl -X POST http://localhost:3000/api/lists/1/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Angebot schreiben","priority":"high","storyPoints":3,"dueAt":"2026-05-31","tags":["Kunde"]}'
```

## Useful Files

| File | Purpose |
|---|---|
| `vite.config.ts` | React, Tailwind, `@/*` alias, dev proxy |
| `tsconfig.json` | Strict TypeScript, DOM/Bun/Vite types, path aliases |
| `components.json` | shadcn/ui configuration |
| `bun-env.d.ts` | Module declarations for SVG and CSS imports |
