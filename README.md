# PowerBoard

PowerBoard is a local ToDo/Kanban application for managing multiple boards. The app uses a React frontend, a Bun API/static server, and an embedded SQLite database. It can run as two local development processes, as a single production server, or as a packaged macOS desktop app.

## Features

- Multiple active and archived Kanban lists
- Task lanes: `new`, `in_progress`, and `done`
- Drag-and-drop status changes plus keyboard-friendly move buttons
- Due dates, priorities, story points, tags, search, filters, and sorting
- Inline task editing with descriptions, subtasks, checklist tooltips, and activity notes
- Activity history in a modal dialog with per-entry date/time stamps
- Task and list archiving with one-step undo/restore
- Dashboard counters for open, due today, overdue, and urgent tasks
- German/English language and light/dark/system theme preferences restored across macOS app restarts
- Keyboard shortcuts: `/` focuses search, `N` opens the new-task dialog, `Escape` closes dialogs/editing

## Requirements

- Bun 1.3 or newer
- macOS for `bun run package:mac`

## Quick Start

Install dependencies:

```bash
bun install
```

Start both local development processes in the background:

```bash
./start.sh
# or
bun run app:start
```

Then open:

```text
http://localhost:5173/
```

Stop the background processes:

```bash
./stop.sh
# or
bun run app:stop
```

`start.sh` starts the Bun API server and the Vite frontend server, writes PID files to `.runtime/`, writes logs to `logs/api.log` and `logs/frontend.log`, waits until both URLs are reachable, and reports the local addresses. If a matching service is already running, it reuses or records the existing listener.

`stop.sh` stops the frontend and API processes tracked in `.runtime/`. If PID files are missing but the standard ports are reachable, it attempts to find the listener with `lsof` and stop that process tree.

Remove generated build and local runtime artifacts:

```bash
bun run clean
```

This removes `dist/`, `build/`, `release/`, `.runtime/`, and `logs/`. It intentionally leaves `data/` untouched.

## Manual Development

You can also run the two servers manually:

```bash
bun dev
```

In another terminal:

```bash
bun run dev:api
```

The Vite frontend runs on `http://localhost:5173/` and proxies `/api` to the Bun API on `http://localhost:3000/`.

## Production

Build and run the single Bun production server:

```bash
bun run build
bun start
```

The production server serves API routes and the Vite build from `dist/`.

Useful environment variables:

- `HOST`: bind address, default `0.0.0.0`
- `PORT`: server port, default `3000`
- `TODO_APP_DATA_DIR`: SQLite data directory, default `data/`
- `TODO_APP_DIST_DIR`: frontend build directory, default `dist/`

## macOS App

Create a macOS DMG installer:

```bash
bun run package:mac
```

The packaging script builds the Vite frontend, compiles `src/index.ts` into a Bun executable, creates the macOS icon from `assets/app-icon.svg`, and runs `electron-builder`. The DMG is written to `release/`. The packaged app stores its SQLite database below the user's macOS application support directory.

## Documentation

More detailed documentation lives in [`doc/`](./doc/README.md):

- [Architecture](./doc/01-architecture.md)
- [Development Setup](./doc/02-dev-setup.md)
- [Build Process](./doc/03-build.md)
- [Deployment](./doc/04-deployment.md)
- [Coding Patterns](./doc/05-coding-patterns.md)

## Technology

- Vite 8 + React 19
- Tailwind CSS v4 + shadcn/ui primitives
- Bun native server and `bun:sqlite`
- Electron + electron-builder for the macOS desktop package
