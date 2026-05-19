# Local ToDo Kanban

A local ToDo application with multiple Kanban-style lists. Data is stored in an embedded SQLite database through Bun.

## Features

- Multiple active or archived Kanban lists
- Task status lanes with drag-and-drop and keyboard-friendly move buttons
- Due dates, priorities, tags, search, filters, and sorting
- Inline task editing with descriptions, metadata, subtasks, and notes
- Task and list archiving with one-step undo/restore
- Dashboard counters for open, due today, overdue, and urgent tasks
- Keyboard shortcuts: `/` focuses search, `N` focuses the new task title

To install dependencies:

```bash
bun install
```

To start a development server:

```bash
bun dev
```

To start the Bun API server for local API calls:

```bash
bun run dev:api
```

To run for production:

```bash
bun run build
bun start
```

To create a macOS DMG installer with a drag-to-Applications app:

```bash
bun run package:mac
```

The DMG is written to `release/`. The packaged app stores its SQLite data in the macOS user application support directory.

This project combines [Vite](https://vite.dev/) for the React frontend build with [Bun](https://bun.com) for package management, the API/static production server, and embedded SQLite persistence.
