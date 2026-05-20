# PowerBoard Documentation

This documentation describes PowerBoard, the current full-stack ToDo/Kanban application: a Vite/React frontend, a Bun API/static server, embedded SQLite persistence, helper scripts for local process management, and optional Electron packaging for macOS.

## Quick Start

```bash
bun install
./start.sh
```

Open `http://localhost:5173/`.

Stop the development processes again:

```bash
./stop.sh
```

Manual development is still available with `bun dev` and `bun run dev:api` in separate terminals.

## Project Overview

| Aspect | Value |
|---|---|
| Runtime | Bun 1.3+ |
| Frontend | React 19, Vite 8, TypeScript |
| Styling | Tailwind CSS v4, shadcn/ui New York style, lucide-react |
| API Server | Bun native `Bun.serve()` |
| Persistence | Embedded SQLite via `bun:sqlite` |
| Desktop Shell | Electron, packaged with `electron-builder` |
| Local Helpers | `start.sh` and `stop.sh` manage API/frontend background processes |

## Table of Contents

- [Architecture](./01-architecture.md)
- [Development Setup](./02-dev-setup.md)
- [Build Process](./03-build.md)
- [Deployment](./04-deployment.md)
- [Coding Patterns](./05-coding-patterns.md)
