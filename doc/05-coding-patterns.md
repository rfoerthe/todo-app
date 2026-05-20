# Coding Patterns

## Overview

The project uses TypeScript, React function components, shadcn/ui primitives, Tailwind CSS v4, and a small Bun API server. Keep changes close to the existing patterns: explicit types, local component state, simple API helpers, and SQLite queries in `src/index.ts`.

## React Patterns

Components are function components. `src/frontend.tsx` wraps the app in `StrictMode`, and `src/App.tsx` only mounts `TodoApp`.

```tsx
export function App() {
  return <TodoApp />;
}
```

`TodoApp` uses:

- `useState` for UI state, form state, saving/error flags, editing state, and dialog visibility
- `useMemo` for derived dashboard counts, filtered todos, tags, and grouped lanes
- `useCallback` for list/todo loading functions
- `useEffect` for initial loading, keyboard shortcuts, theme application, and localStorage persistence

## API Calls

Frontend API calls go through the local `api<T>()` helper in `src/TodoApp.tsx`.

```tsx
async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Request failed");
  }

  return data as T;
}
```

Mutations generally set `saving`, clear `error`, call the API, then reload the selected list and board counts. Archive and restore operations also set a `lastUndo` action when the UI can offer one-step undo.

## Validation Patterns

Server-side validation lives in `src/index.ts`:

- `requiredText()` trims and requires non-empty strings
- `optionalText()` trims optional strings
- `optionalDate()` accepts empty strings or `YYYY-MM-DD`
- `parseStatus()` restricts todo statuses
- `parsePriority()` restricts priorities
- `parseStoryPoints()` restricts point values
- `parseTags()` normalizes, deduplicates, and caps tags

Prefer extending these helpers when adding fields instead of duplicating ad hoc validation inside route branches.

## SQLite Patterns

The schema is created with `CREATE TABLE IF NOT EXISTS`. Additive migrations use:

```ts
ensureColumn("todos", "story_points", "INTEGER NOT NULL DEFAULT 0");
```

Use prepared `db.query(...).get()`, `.all()`, or `.run()` calls. Keep list/todo read shaping in helper functions such as `getLists()`, `getTodos()`, `getSubtasks()`, and `getActivity()`.

Activity log writes should go through:

```ts
logActivity(listId, todoId, action, detail);
```

Activity entries are ordered newest-first by `created_at DESC, id DESC` and exposed to the frontend as `createdAt`. Format these timestamps in the UI layer so language-specific display remains a frontend concern.

## Archive Rules

The current domain rules are enforced server-side:

- archived lists are read-only
- todos can only be archived when status is `done`
- target lists for moved todos must be active
- deleting a list or todo means setting `archived_at`, not hard deletion
- deleting a subtask is a hard delete

Keep these rules in the API even if the UI also hides actions.

## shadcn/ui Patterns

UI primitives live in `src/components/ui/` and follow shadcn conventions:

- `data-slot` attributes for stable styling hooks
- `cn()` from `src/lib/utils.ts` for class merging
- `React.ComponentProps<"element">` for native element props
- `class-variance-authority` for button variants
- Radix primitives where needed, for example `Label`

Example:

```tsx
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return <input type={type} className={cn("base classes", className)} {...props} />;
}
```

## Styling Patterns

Tailwind CSS v4 is imported from `styles/globals.css`, with app-level additions in `src/index.css`.

The app supports light, dark, and system themes. `TodoApp` toggles the `dark` class on `document.documentElement` and sets `colorScheme` to match. Use existing slate/neutral surface styles and lane-specific color accents when adding UI.

Keep task cards compact. Use icon buttons for secondary card actions, and keep larger histories or forms in modal dialogs when inline content would make cards hard to scan. Checklist labels may be visually truncated, but preserve full text through a native `title` tooltip when the visible label can overflow.

## TypeScript Patterns

Important compiler settings:

```json
{
  "strict": true,
  "module": "Preserve",
  "moduleResolution": "bundler",
  "verbatimModuleSyntax": true,
  "noUncheckedIndexedAccess": true,
  "noImplicitOverride": true
}
```

Use the `@/*` alias for imports from `src/`:

```tsx
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
```

## Process Scripts

`start.sh` and `stop.sh` are Bash scripts with `set -euo pipefail`. They intentionally keep runtime state in project-local directories:

- `.runtime/` for PID files
- `logs/` for API and frontend logs

When changing these scripts, preserve idempotency: starting twice should report existing services, and stopping twice should be harmless.

`bun run clean` uses `rimraf` for generated artifacts only:

```bash
rimraf dist build release .runtime logs
```

Do not include `data/` in the default clean script because it contains the local SQLite database.
