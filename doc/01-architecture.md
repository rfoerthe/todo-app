# Architecture

## High-Level Overview

```text
Browser / Electron BrowserWindow
  -> index.html
     -> src/frontend.tsx
        -> React App
           -> TodoApp
              -> fetch("/api/...")

Development
  -> start.sh
     -> bun run dev:api      (Bun API on :3000)
     -> bun dev              (Vite frontend on :5173, /api proxy)

Production server
  -> bun run build
  -> bun start
     -> API routes
     -> static SPA serving from dist/

Packaged macOS app
  -> Electron main process
     -> starts compiled Bun API on a free 127.0.0.1 port
     -> loads the local app URL in BrowserWindow
```

## Main Modules

| File | Responsibility |
|---|---|
| `src/frontend.tsx` | React entrypoint and StrictMode render |
| `src/App.tsx` | Root component that mounts `TodoApp` |
| `src/TodoApp.tsx` | Board UI, filters, editing, archive views, theme selection, API calls |
| `src/index.ts` | Bun server, SQLite schema/migrations, API routes, static file serving |
| `electron/main.cjs` | Desktop shell, local API process lifecycle, BrowserWindow setup |
| `scripts/build-macos-dmg.mjs` | macOS packaging pipeline |
| `start.sh` / `stop.sh` | Local background process management for development |

## Application Model

| Entity | Purpose |
|---|---|
| `todo_lists` | Kanban boards with optional `archived_at` timestamp |
| `todos` | Cards belonging to one list |
| `subtasks` | Checklist items belonging to one todo |
| `todo_activity` | Activity and note log entries for lists/todos |

Each todo has one of three statuses:

- `new`
- `in_progress`
- `done`

Each todo has one of four priorities:

- `low`
- `medium`
- `high`
- `urgent`

Story points are restricted to `0, 1, 2, 3, 5, 8, 13, 21, 40`. Due dates are stored as `YYYY-MM-DD` strings. Tags are stored as a JSON array in SQLite and normalized on read/write.

## API Routes

| Route | Methods | Purpose |
|---|---|---|
| `/api/lists` | `GET` | List active boards |
| `/api/lists?archived=1` | `GET` | List archived boards |
| `/api/lists` | `POST` | Create a board |
| `/api/lists/:id` | `PATCH` | Rename, archive, or restore a board |
| `/api/lists/:id` | `DELETE` | Archive a board |
| `/api/lists/:id/todos` | `GET` | List active todos for a board |
| `/api/lists/:id/todos?archived=1` | `GET` | List archived todos for a board |
| `/api/lists/:id/todos?archived=all` | `GET` | List active and archived todos for a board |
| `/api/lists/:id/todos` | `POST` | Create a todo |
| `/api/todos/:id` | `PATCH` | Update todo fields, move to another list, archive, or restore |
| `/api/todos/:id` | `DELETE` | Archive a completed todo |
| `/api/todos/:id/subtasks` | `POST` | Add a subtask |
| `/api/todos/:id/activity` | `POST` | Add an activity note |
| `/api/subtasks/:id` | `PATCH` | Update subtask title/done state |
| `/api/subtasks/:id` | `DELETE` | Delete a subtask |

Archived lists are read-only until restored. Todos can only be archived when their status is `done`.

## Persistence

The server creates and migrates the SQLite database automatically. By default, data is stored at:

```text
data/todos.sqlite
```

The path can be changed with:

```bash
TODO_APP_DATA_DIR=/path/to/data bun start
```

The packaged Electron app sets `TODO_APP_DATA_DIR` to a directory inside the current user's application support data.

## Static Serving

`src/index.ts` serves static files when `NODE_ENV=production` or when an `index.html` exists in the configured dist directory. The default dist path is:

```text
dist/
```

Override it with:

```bash
TODO_APP_DIST_DIR=/path/to/dist bun start
```

Non-API requests fall back to `dist/index.html`, which keeps SPA navigation working.

## Frontend State

`TodoApp` keeps board, task, filter, editing, archive, and saving state in React hooks. It persists these UI preferences in `localStorage`:

- `todo-theme`: `light`, `dark`, or `system`
- `todo-archive-lists-expanded`: whether the archived list section is expanded

The UI loads active and archived lists in parallel, then loads todos for the selected list. Mutating operations reload the selected board and list counts after the API call completes.
