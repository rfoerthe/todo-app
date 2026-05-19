# Development Setup

## Prerequisites

| Requirement | Minimum | Recommended |
|---|---|---|
| **OS** | macOS, Linux, Windows | macOS |
| **Bun** | v1.3.14 | Latest stable |
| **Node.js** | Not required directly | N/A |

### Install Bun

```bash
curl -fsSL https://bun.sh/install | bash
```

Verify installation:

```bash
bun --version
# Expected: 1.3.x or higher
```

## Initial Setup

### 1. Clone / Create Project

```bash
cd my-app
```

### 2. Install Dependencies

```bash
bun install
```

This installs:
- **React 19** + **React DOM 19** — UI framework
- **Vite** + **@vitejs/plugin-react** — Frontend dev server and build
- **Tailwind CSS v4** — Utility-first CSS
- **@tailwindcss/vite** — Tailwind processing in Vite
- **shadcn/ui** primitives (via `@radix-ui/*`) — Accessible UI components
- **class-variance-authority** — Variant-based styling (used by shadcn/ui)
- **clsx** + **tailwind-merge** — Conditional class name merging
- **lucide-react** — Icon library
- **tw-animate-css** — Animation utilities
- **bun:sqlite** — Embedded SQLite database access through Bun

### 3. Verify Development Servers

```bash
bun dev
```

In another terminal:

```bash
bun run dev:api
```

Expected output:

```
VITE ... ready in ...
API server running at http://localhost:3000
```

Open `http://localhost:5173` in a browser. You should see:
- ToDo list navigation
- A Kanban board with the lanes Neu, In Bearbeitung, and Erledigt
- A form for creating new ToDos

## Development Workflow

### Hot Module Replacement (HMR)

The frontend dev server uses Vite Fast Refresh:

```bash
bun dev
```

**What HMR does:**
- React components update in-place without full page reload
- CSS changes apply instantly
- Server-side route changes are handled by the separate Bun API server

**HMR in action:**
1. Edit `src/App.tsx`
2. Save the file
3. Browser updates automatically — no refresh needed

### Project Structure for Development

```
src/
├── index.ts              ← Server entry (routes, serve config)
├── frontend.tsx          ← React entrypoint (createRoot + render)
├── App.tsx               ← Root component
├── TodoApp.tsx           ← ToDo list and Kanban UI
├── index.css             ← Page styles
├── components/ui/        ← shadcn/ui primitives
└── lib/                  ← Shared utilities
```

### Key Development Files

| File | Purpose | Edit Frequency |
|---|---|---|
| `src/App.tsx` | Root component layout | High |
| `src/TodoApp.tsx` | ToDo list and Kanban feature | High |
| `src/components/ui/*.tsx` | UI primitives (auto-generated) | Low |
| `src/index.ts` | Server routes and SQLite persistence | Medium |
| `styles/globals.css` | Theme variables | Low |
| `tsconfig.json` | TypeScript settings | Rare |

## Available Scripts

| Script | Command | Description |
|---|---|---|
| `dev` | `vite --host 0.0.0.0` | Frontend dev server with React Fast Refresh |
| `dev:api` | `bun --hot src/index.ts` | Bun API server for local `/api` calls |
| `start` | `NODE_ENV=production bun src/index.ts` | Production server |
| `build` | `vite build` | Production frontend build → `dist/` |
| `preview` | `vite preview --host 0.0.0.0` | Preview only the static frontend build |

### Running Scripts

```bash
# Frontend development
bun dev

# API development
bun run dev:api

# Production (after build)
bun start

# Build output
bun run build
```

## IDE Configuration

### TypeScript Path Aliases

The `tsconfig.json` configures `@/*` → `./src/*`:

```json
"paths": {
  "@/*": ["./src/*"]
}
```

Use in code:

```tsx
// Instead of:
import { Button } from "../../components/ui/button";

// Use:
import { Button } from "@/components/ui/button";
```

### vite.config.ts

`vite.config.ts` configures React, Tailwind CSS, the `@/*` alias, and the local `/api` proxy to the Bun server.

### bun-env.d.ts

Type declarations for module imports:

```ts
declare module "*.svg" {
  const path: `${string}.svg`;
  export = path;
}

declare module "*.css" {}

declare module "*.module.css" {
  const classes: { readonly [key: string]: string };
  export = classes;
}
```

## Development Tips

### Testing API Routes

Test directly via curl:

```bash
curl http://localhost:3000/api/lists
# {"lists":[...]}

curl -X POST http://localhost:3000/api/lists \
  -H "Content-Type: application/json" \
  -d '{"name":"Projekt"}'

curl -X POST http://localhost:3000/api/lists/1/todos \
  -H "Content-Type: application/json" \
  -d '{"title":"Angebot schreiben","description":"Bis Freitag"}'
```

### Adding New API Routes

Edit `src/index.ts` in `handleApi()`:

```ts
if (url.pathname === "/api/my-route" && req.method === "GET") {
  return Response.json({ message: "Hello from GET" });
}
```

### Adding New Components

1. Create component in `src/components/ui/` or `src/components/`
2. Use the `cn()` utility for conditional Tailwind classes
3. Import with `@/` alias

### Debugging

- **Browser console** — Logs are echoed to the terminal in dev mode
- **Terminal** — Server logs appear here; HMR events shown
- **Network tab** — Inspect API responses in browser DevTools
