# Coding Patterns

## Overview

This project follows modern React patterns with shadcn/ui conventions. All code uses TypeScript with strict mode.

## React Patterns

### 1. Functional Components (Only)

All components are functional. No class components are used.

```tsx
// ✅ Good
function Button({ className, ...props }) {
  return <button className={className} {...props} />;
}

// ❌ Not used
class Button extends React.Component { ... }
```

### 2. Named + Default Exports

Components use named exports primarily:

```tsx
// Component file
function Button({ ... }) { ... }
export { Button };

// Usage
import { Button } from "@/components/ui/button";
```

The root `App` component also has a default export for convenience:

```tsx
export function App() { ... }
export default App;
```

### 3. StrictMode Wrapping

The React app is wrapped in `StrictMode` in the entrypoint:

```tsx
const app = (
  <StrictMode>
    <App />
  </StrictMode>
);
```

### 4. Component Composition

Components are composed hierarchically:

```tsx
// App.tsx — composition at the page level
export function App() {
  return <TodoApp />;
}
```

## shadcn/ui Patterns

### 1. `data-slot` Attribute Pattern

All shadcn/ui components use `data-slot` for styling hooks:

```tsx
<div data-slot="card" className={cn("...", className)} {...props} />
<div data-slot="card-header" className={cn("...", className)} {...props} />
<div data-slot="button" className={cn("...", className)} {...props} />
```

This enables CSS targeting without coupling to class names:

```css
[data-slot="card"] { /* styles */ }
[data-slot="button"] { /* styles */ }
```

### 2. `cn()` Utility for Class Merging

All components use the `cn()` utility for merging Tailwind classes:

```tsx
import { cn } from "@/lib/utils";

function Button({ className, ...props }) {
  return (
    <button
      className={cn(
        "base-classes-here",
        variantClasses[variant],
        className,           // ← user-provided overrides
      )}
      {...props}
    />
  );
}
```

The `cn()` implementation:

```tsx
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**How it works:**
1. `clsx()` — Combines class strings/objects, handles falsy values
2. `twMerge()` — Resolves Tailwind conflicts (last class wins)

### 3. `React.ComponentProps<"element">` Pattern

Props are typed using React's built-in utility:

```tsx
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return <input type={type} className={cn(...)} {...props} />;
}
```

This automatically infers all standard HTML input attributes.

### 4. Variant Pattern with `cva`

The Button component uses `class-variance-authority` for variants:

```tsx
const buttonVariants = cva(
  "base-classes",  // ← shared across all variants
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        destructive: "bg-destructive text-white",
        outline: "border bg-background",
        secondary: "bg-secondary text-secondary-foreground",
        ghost: "hover:bg-accent",
        link: "text-primary underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3",
        lg: "h-10 px-6",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
```

Usage:

```tsx
const className = cn(
  buttonVariants({ variant, size }),
  className,  // user override
);
```

### 5. "use client" Directive

Some components include `"use client"` for client-side rendering:

```tsx
"use client";

import * as LabelPrimitive from "@radix-ui/react-label";
```

This signals that the component must run in the browser (not server).

### 6. Primitive Wrapping

shadcn/ui components wrap Radix UI primitives:

```tsx
import * as LabelPrimitive from "@radix-ui/react-label";

function Label({ className, ...props }) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn("...", className)}
      {...props}
    />
  );
}
```

**Pattern:**
1. Import Radix primitive (`* as X from "@radix-ui/..."`)
2. Wrap with custom styling
3. Pass through all props

## TypeScript Patterns

### 1. Strict Compiler Options

```json
{
  "strict": true,
  "skipLibCheck": true,
  "noFallthroughCasesInSwitch": true,
  "noUncheckedIndexedAccess": true,
  "noImplicitOverride": true,
  "verbatimModuleSyntax": true
}
```

### 2. Path Aliases

```json
{
  "paths": {
    "@/*": ["./src/*"]
  }
}
```

Usage:

```tsx
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
```

### 3. Type-Safe Props

```tsx
function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  // ...
}
```

### 4. Module Declarations

For non-TypeScript modules (`bun-env.d.ts`):

```ts
declare module "*.svg" {
  const path: `${string}.svg`;
  export = path;
}
```

## Styling Patterns

### 1. Tailwind CSS v4 — `@theme inline`

Theme variables are defined inline:

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  /* ... */
}
```

### 2. CSS Variables for Theming

```css
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
}
```

### 3. Dark Mode via Class Selector

```css
.dark {
  /* override variables */
}
```

Toggle with: `<html class="dark">`

### 4. Container Queries

```css
@container/card-header {
  /* styles when .card-header container matches */
}
```

## Server Patterns

### 1. Bun Server + SQLite

```ts
import { Database } from "bun:sqlite";

const db = new Database("data/todos.sqlite", { create: true });
db.exec("PRAGMA foreign_keys = ON");
```

### 2. Route Handlers

```ts
if (url.pathname === "/api/lists" && req.method === "GET") {
  return Response.json({ lists: getLists() });
}

if (url.pathname === "/api/lists" && req.method === "POST") {
  const body = await req.json();
  // validate and insert
}
```

### 3. Dynamic Routes

```ts
const todoMatch = url.pathname.match(/^\/api\/todos\/(\d+)$/);

if (todoMatch && req.method === "PATCH") {
  const todoId = Number(todoMatch[1]);
  // update todo
}
```

### 4. Catch-All for SPA

```ts
return serveStaticAsset(req);
```

In production, non-API requests are resolved from `dist/` and fall back to `dist/index.html`.

## Component Architecture Patterns

### File Organization

```
src/
├── *.tsx              ← Page-level / feature components
├── components/ui/     ← shadcn/ui primitives (auto-generated)
└── lib/               ← Shared utilities
```

### Component File Template

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

function ComponentName({ className, ...props }: React.ComponentProps<"element">) {
  return (
    <element
      data-slot="component-name"
      className={cn("base-classes", className)}
      {...props}
    />
  );
}

export { ComponentName };
```

### Feature Component Template

```tsx
import { Button } from "@/components/ui/button";
import { useRef, type FormEvent } from "react";

export function FeatureComponent() {
  const ref = useRef<HTMLDivElement>(null);

  const handler = async (e: FormEvent) => {
    e.preventDefault();
    // ...
  };

  return (
    <div className="flex flex-col gap-6">
      {/* UI */}
    </div>
  );
}
```

## Code Style Guidelines

### 1. Import Order

```tsx
// 1. External libraries
import * as React from "react";
import { cva } from "class-variance-authority";

// 2. Internal modules (with @/ alias)
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// 3. Local resources
import logo from "./logo.svg";
```

### 2. Naming Conventions

| Type | Convention | Example |
|---|---|---|
| Components | PascalCase | `CardHeader`, `TodoApp` |
| Functions | camelCase | `createTodo`, `cn` |
| Variables | camelCase | `formData`, `selectedListId` |
| Constants | UPPER_SNAKE | (rarely used) |
| Files | camelCase | `frontend.tsx`, `utils.ts` |
| CSS classes | kebab-case | `card-header`, `text-sm` |

### 3. Error Handling

Use try/catch for async operations:

```tsx
try {
  await api(`/api/todos/${todoId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  // ...
} catch (error) {
  // Handle error
  setError(error instanceof Error ? error.message : "Request failed");
}
```

### 4. Accessibility

- Use semantic HTML (`<button>`, `<form>`, `<label>`)
- Add `sr-only` labels for screen readers
- Use Radix UI primitives for accessible popovers/dropdowns
- Respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion) {
  *, ::before, ::after {
    animation: none !important;
  }
}
```
