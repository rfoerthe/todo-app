# Deployment

## Overview

This is a **static + server hybrid** application. Vite builds the React SPA into `dist/`, and the Bun server serves that SPA together with the API endpoints. Deployment targets any environment that can run Bun.

## Deployment Options

### Option 1: Bun Server (Recommended)

```bash
# Build the app
bun run build

# Run with bundled Bun
NODE_ENV=production bun src/index.ts
```

**Steps:**
1. Build: `bun run build`
2. Copy `dist/`, `src/`, `package.json`, and `bun.lock` to target server
3. Install Bun on target
4. Run: `NODE_ENV=production bun src/index.ts`

### Option 2: Docker

```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen

FROM base AS build
COPY --from=deps /app /app
COPY . .
RUN bun run build

FROM oven/bun:1-slim
WORKDIR /app
COPY --from=build /app /app
EXPOSE 3000
CMD ["bun", "src/index.ts"]
```

Build and run:

```bash
docker build -t bun-react-app .
docker run -p 3000:3000 bun-react-app
```

### Option 3: Static Export (Frontend Only)

For the frontend only, extract the `dist/` output and serve with any static file server:

```bash
bun run build
# Serve dist/ with nginx, caddy, cloud storage, etc.
```

**Note:** API routes won't work with static-only deployment.

## Production Server

### Start Command

```bash
NODE_ENV=production bun src/index.ts
```

Or via package.json:

```bash
bun start
```

### Production Behavior

When `NODE_ENV=production`:
- HMR is **disabled**
- Console echo is **disabled**
- Vite-built assets are served from `dist/`
- `process.env.NODE_ENV` is `"production"`

### Server Configuration

The server is configured in `src/index.ts`:

```ts
const server = serve({
  fetch(req) {
    // API routes first; production static fallback second.
  },
});
```

In production, non-API requests are resolved from `dist/` and fall back to `dist/index.html`.

## Hosting Recommendations

### Platform Options

| Platform | Type | Notes |
|---|---|---|
| **Railway** | PaaS | Native Bun support |
| **Render** | PaaS | Custom service with Bun |
| **Fly.io** | Edge | Container-based, close to users |
| **VPS (DigitalOcean, Hetzner)** | Bare metal | Full control |
| **AWS EC2** | Cloud | Scalable infrastructure |

### Reverse Proxy (Nginx Example)

```nginx
server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Caddy Example

```caddy
example.com {
    reverse_proxy localhost:3000
}
```

## Environment Variables

### Exposing to Browser

Variables prefixed with `VITE_` are exposed to the browser by Vite:

```bash
VITE_API_URL=https://api.example.com
```

Usage:

```ts
// Access in browser code
const apiUrl = import.meta.env.VITE_API_URL;
```

### Server-Side Variables

Standard Node/Bun environment variables work server-side:

```ts
const isProd = process.env.NODE_ENV === "production";
```

Set via:

```bash
NODE_ENV=production bun src/index.ts

# Or in .env file
NODE_ENV=production
VITE_API_URL=https://api.example.com
```

## SSL / HTTPS

### With Reverse Proxy (Recommended)

Let Nginx/Caddy handle TLS termination:

```nginx
server {
    listen 443 ssl;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3000;
    }
}
```

### With Bun Native TLS

```ts
const server = serve({
  port: 3000,
  tls: {
    cert: Bun.file("./cert.pem"),
    key: Bun.file("./key.pem"),
  },
  // ...
});
```

## Production Checklist

- [ ] Run `bun run build` to generate `dist/`
- [ ] Set `NODE_ENV=production`
- [ ] Configure reverse proxy (Nginx/Caddy)
- [ ] Enable HTTPS / TLS
- [ ] Set environment variables
- [ ] Configure process manager (systemd, PM2, etc.)
- [ ] Set up monitoring / logging
- [ ] Test API routes
- [ ] Test SPA routing (catch-all)

## Process Management

### systemd (Linux)

```ini
[Unit]
Description=Bun React App
After=network.target

[Service]
Type=simple
User=deploy
WorkingDirectory=/opt/app
ExecStart=bun src/index.ts
Environment=NODE_ENV=production
Restart=always

[Install]
WantedBy=multi-user.target
```

### PM2

```json
{
  "apps": [{
    "name": "bun-react-app",
    "script": "src/index.ts",
    "interpreter": "bun",
    "env_production": {
      "NODE_ENV": "production"
    }
  }]
}
```

```bash
pm2 start ecosystem.config.js --env production
```
