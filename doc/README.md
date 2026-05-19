# Local ToDo Kanban

A local full-stack ToDo/Kanban application built with **Vite**, **Bun**, **React 19**, **Tailwind CSS v4**, **shadcn/ui**, and embedded **SQLite**.

## Quick Start

```bash
# Install dependencies
bun install

# Start development server
bun dev

# Start Bun API server in another terminal
bun run dev:api

# Build for production
bun run build

# Run production server
bun start
```

## Project Overview

| Aspect | Value |
|---|---|
| **Runtime** | Bun v1.3+ |
| **Framework** | React 19 (no RSC) |
| **CSS** | Tailwind CSS v4 + shadcn/ui (New York style) |
| **Build** | Vite + `@tailwindcss/vite` |
| **API Server** | Bun native `serve()` |
| **Persistence** | Embedded SQLite via `bun:sqlite` |
| **Component Style** | shadcn/ui v2 (file-based, `data-slot` pattern) |
| **Icons** | Lucide React |
| **TypeScript** | Strict mode, `Preserve` modules |

## Table of Contents

- [Architecture](./01-architecture.md)
- [Development Setup](./02-dev-setup.md)
- [Build Process](./03-build.md)
- [Deployment](./04-deployment.md)
- [Coding Patterns](./05-coding-patterns.md)
