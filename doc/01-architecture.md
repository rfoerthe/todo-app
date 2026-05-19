# Architecture

## High-Level Overview

```
Browser
  └─ index.html
     └─ /src/frontend.tsx
        └─ React App
           └─ TodoApp
              └─ fetch("/api/...")

Development
  ├─ Vite dev server
  │  ├─ React HMR
  │  └─ /api proxy → http://localhost:3000
  └─ Bun API server
     ├─ src/index.ts
     └─ data/todos.sqlite

Production
  ├─ vite build → dist/
  └─ Bun server
     ├─ ToDo list API
     ├─ ToDo card API
     ├─ embedded SQLite database
     └─ static SPA serving from dist/
```

## Application Model

| Entity | Purpose |
|---|---|
| `todo_lists` | Named Kanban boards; there are no users or ownership records |
| `todos` | Cards belonging to one list |

Each ToDo has one of three statuses:

- `new` → Neu
- `in_progress` → In Bearbeitung
- `done` → Erledigt

## Frontend

| File | Role |
|---|---|
| `index.html` | Vite HTML entry; loads `src/frontend.tsx` |
| `src/frontend.tsx` | React entrypoint |
| `src/App.tsx` | Root component |
| `src/TodoApp.tsx` | List management and Kanban board |
| `src/components/ui/*.tsx` | shadcn/ui primitive components |
| `styles/globals.css` | Tailwind theme and CSS variables |

## Backend

`src/index.ts` uses Bun's native server and `bun:sqlite`:

- `GET /api/lists`
- `POST /api/lists`
- `PATCH /api/lists/:id`
- `DELETE /api/lists/:id`
- `GET /api/lists/:id/todos`
- `POST /api/lists/:id/todos`
- `PATCH /api/todos/:id`
- `DELETE /api/todos/:id`

In development, Vite serves the frontend and proxies `/api` to Bun. In production, Bun serves both API routes and the Vite output from `dist/`.

## Persistence

The embedded database is created automatically at:

```
data/todos.sqlite
```

On first start, the server creates the tables and seeds one example list.
