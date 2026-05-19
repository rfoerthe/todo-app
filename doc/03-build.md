# Build Process

## Overview

The frontend build is handled by **Vite**. Bun remains the package manager and the production API/static server.

## Build Configuration

Location: `vite.config.ts`

```ts
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(projectRoot, "src"),
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
```

## Build Steps

1. `index.html` is used as the Vite entrypoint.
2. Vite bundles `src/frontend.tsx` and the React component tree.
3. `@tailwindcss/vite` processes `styles/globals.css` and Tailwind utilities.
4. Static assets such as SVGs are fingerprinted.
5. The production output is written to `dist/`.

## Running the Build

```bash
bun run build
```

Equivalent direct command:

```bash
bunx vite build
```

## Output Structure

After `bun run build`, the `dist/` directory contains:

```
dist/
├── index.html
├── assets/
│   ├── index-[hash].css
│   ├── index-[hash].js
│   └── *.svg
└── ...
```

## Development vs Production

| Aspect | Development | Production |
|---|---|---|
| Frontend server | Vite dev server | Bun serves `dist/` |
| API server | Bun via `bun run dev:api` | Bun via `bun start` |
| React updates | Fast Refresh | N/A |
| Output | In memory | `dist/` directory |
| API routing | Vite proxy to Bun | Same Bun process |

## Production Flow

```bash
bun run build
bun start
```

`bun start` sets `NODE_ENV=production` and runs `src/index.ts`. In that mode the Bun server serves API routes and falls back to static files from `dist/`.
