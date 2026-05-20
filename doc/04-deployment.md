# Deployment

## Overview

The application has two production shapes:

- Bun server deployment: one Bun process serves API routes and the built React SPA.
- macOS desktop deployment: Electron starts a packaged Bun API binary and displays the app in a BrowserWindow.

The local `start.sh` and `stop.sh` scripts are for development convenience, not production process management.

## Bun Server Deployment

Build the frontend:

```bash
bun run build
```

Start the server:

```bash
bun start
```

Equivalent command:

```bash
NODE_ENV=production bun src/index.ts
```

Recommended environment:

```bash
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
TODO_APP_DATA_DIR=/var/lib/powerboard
TODO_APP_DIST_DIR=/opt/powerboard/dist
```

The deployment artifact must include at least:

- `dist/`
- `src/`
- `package.json`
- `bun.lock`

Run `bun install --production` on the target or build a container image with dependencies installed.

## Docker Example

```dockerfile
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1 AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM oven/bun:1-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 3000
CMD ["bun", "src/index.ts"]
```

Build and run:

```bash
docker build -t powerboard .
docker run -p 3000:3000 -v powerboard-data:/app/data powerboard
```

## Reverse Proxy

Nginx example:

```nginx
server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Caddy example:

```caddy
example.com {
    reverse_proxy localhost:3000
}
```

Terminate TLS in the reverse proxy unless there is a specific need to configure Bun native TLS.

## systemd Example

```ini
[Unit]
Description=PowerBoard
After=network.target

[Service]
Type=simple
User=todo
WorkingDirectory=/opt/powerboard
Environment=NODE_ENV=production
Environment=HOST=127.0.0.1
Environment=PORT=3000
Environment=TODO_APP_DATA_DIR=/var/lib/powerboard
ExecStart=/usr/local/bin/bun src/index.ts
Restart=always

[Install]
WantedBy=multi-user.target
```

## macOS Desktop Deployment

Build the installer:

```bash
bun run package:mac
```

This creates a DMG in `release/`. The packaged app:

- launches Electron as the desktop shell
- finds a free local port on `127.0.0.1`
- starts the compiled API binary from app resources
- sets `NODE_ENV=production`
- sets `TODO_APP_DATA_DIR` to the user's app data directory
- sets `TODO_APP_DIST_DIR` to the packaged `dist/`
- loads the local app URL in a sandboxed BrowserWindow

## Data and Backups

The SQLite database file is `todos.sqlite` inside `TODO_APP_DATA_DIR`.

For server deployments, back up that directory. For the macOS app, back up the app support data for the current user.

## Static-Only Hosting

The `dist/` folder can be served by a static host, but the application will not be functional without the Bun API because all list, todo, subtask, and activity data is loaded through `/api`.

Use static-only hosting only for UI inspection or if a separate compatible API is provided.

## Production Checklist

- [ ] Run `bun run build`
- [ ] Set `NODE_ENV=production`
- [ ] Set a persistent `TODO_APP_DATA_DIR`
- [ ] Configure process management or container restart policy
- [ ] Put the app behind HTTPS for remote access
- [ ] Verify `GET /api/lists`
- [ ] Verify the SPA loads and browser refresh works on non-root paths
- [ ] Verify database backups
