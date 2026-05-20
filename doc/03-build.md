# Build Process

## Frontend Build

The frontend build is handled by Vite:

```bash
bun run build
```

Build flow:

1. `index.html` is used as the Vite entrypoint.
2. Vite bundles `src/frontend.tsx` and the React component tree.
3. `@tailwindcss/vite` processes `src/index.css` and `styles/globals.css`.
4. Static assets are fingerprinted.
5. Output is written to `dist/`.

Typical output:

```text
dist/
  index.html
  assets/
    index-[hash].css
    index-[hash].js
```

## Vite Configuration

`vite.config.ts` configures:

- React via `@vitejs/plugin-react`
- Tailwind CSS v4 via `@tailwindcss/vite`
- `@/*` alias to `src/`
- dev server host `0.0.0.0`
- `/api` proxy to `http://localhost:3000`

## Production Server Build

The production server is not bundled for normal server deployment. Run it directly with Bun after building the frontend:

```bash
bun run build
bun start
```

`bun start` sets `NODE_ENV=production` and runs `src/index.ts`. In that mode, the same Bun process handles API routes and static files from `dist/`.

Useful production overrides:

```bash
HOST=127.0.0.1 PORT=8080 TODO_APP_DATA_DIR=/var/lib/powerboard TODO_APP_DIST_DIR=/opt/powerboard/dist bun start
```

## Development Helper Scripts

`start.sh` and `stop.sh` do not create production artifacts. They are convenience wrappers for local development:

- `start.sh` runs `bun run dev:api` and `bun dev` with `nohup`
- PID files are written to `.runtime/`
- logs are written to `logs/`
- `stop.sh` stops the tracked frontend/API process trees

Clean generated artifacts with:

```bash
bun run clean
```

The clean script uses `rimraf` to remove `dist/`, `build/`, `release/`, `.runtime/`, and `logs/`. It does not remove `data/`.

## macOS DMG Build

Create a packaged desktop app:

```bash
bun run package:mac
```

The packaging script performs these steps:

1. Runs `bun run build`.
2. Compiles `src/index.ts` into `build/server/todo-api` with `bun build --compile`.
3. Generates `build/icons/icon.icns` from `assets/app-icon.svg` using `sharp` and `iconutil`.
4. Runs `electron-builder --mac dmg` for the current CPU architecture.

The Electron package includes:

- `electron/main.cjs`
- `dist/`
- `build/server/todo-api`
- package metadata from `package.json`

The DMG is written to `release/`.

## Development vs Production

| Aspect | Development | Production Server | Packaged macOS App |
|---|---|---|---|
| Frontend | Vite dev server on `:5173` | Served from `dist/` | Served from packaged `dist/` |
| API | Bun hot server on `:3000` | Bun server on `PORT` or `3000` | Compiled Bun binary on a free local port |
| Startup | `./start.sh` or two manual commands | `bun run build && bun start` | Launch the Electron app |
| Data | `data/todos.sqlite` by default | `TODO_APP_DATA_DIR` or `data/` | macOS user app data directory |
| Static fallback | Vite handles app shell | Bun falls back to `index.html` | Bun binary falls back to packaged `index.html` |
