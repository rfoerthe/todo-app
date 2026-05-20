import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const isProduction = process.env.NODE_ENV === "production";
const distDir = path.resolve(process.env.TODO_APP_DIST_DIR ?? path.join(process.cwd(), "dist"));
const dataDir = path.resolve(process.env.TODO_APP_DATA_DIR ?? path.join(process.cwd(), "data"));
const shouldServeStatic = isProduction || existsSync(path.join(distDir, "index.html"));

mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "todos.sqlite"), { create: true });
db.run("PRAGMA foreign_keys = ON");
db.run(`
  CREATE TABLE IF NOT EXISTS todo_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'done')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (list_id) REFERENCES todo_lists(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS subtasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    todo_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS todo_activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_id INTEGER NOT NULL,
    todo_id INTEGER,
    action TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (list_id) REFERENCES todo_lists(id) ON DELETE CASCADE,
    FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS app_preferences (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    language TEXT NOT NULL DEFAULT 'de' CHECK (language IN ('de', 'en')),
    theme_mode TEXT NOT NULL DEFAULT 'system' CHECK (theme_mode IN ('light', 'dark', 'system'))
  );
`);

db.query("INSERT OR IGNORE INTO app_preferences (id) VALUES (1)").run();

function ensureColumn(table: string, column: string, definition: string) {
  const columns = db.query<{ name: string }, []>(`PRAGMA table_info(${table})`).all();

  if (!columns.some(existing => existing.name === column)) {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumn("todo_lists", "archived_at", "TEXT");
ensureColumn("todos", "priority", "TEXT NOT NULL DEFAULT 'medium'");
ensureColumn("todos", "due_at", "TEXT NOT NULL DEFAULT ''");
ensureColumn("todos", "archived_at", "TEXT");
ensureColumn("todos", "tags", "TEXT NOT NULL DEFAULT '[]'");
ensureColumn("todos", "story_points", "INTEGER NOT NULL DEFAULT 0");

const listCount = db.query<{ count: number }, []>("SELECT COUNT(*) AS count FROM todo_lists").get();

if (!listCount?.count) {
  const insertList = db.query("INSERT INTO todo_lists (name) VALUES (?)");
  const insertTodo = db.query("INSERT INTO todos (list_id, title, description, status, priority, due_at, tags, story_points) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  const { lastInsertRowid } = insertList.run("Persönliche Aufgaben");
  const listId = Number(lastInsertRowid);

  insertTodo.run(listId, "Erste Aufgabe anlegen", "Neue Karten starten immer in der Lane Neu.", "new", "medium", "", "[]", 0);
  insertTodo.run(
    listId,
    "Board ausprobieren",
    "Karten können zwischen den Lanes verschoben werden.",
    "in_progress",
    "high",
    "",
    JSON.stringify(["Demo"]),
    0,
  );
}

type TodoStatus = "new" | "in_progress" | "done";
type Priority = "low" | "medium" | "high" | "urgent";
type ThemeMode = "light" | "dark" | "system";
type Language = "de" | "en";
type RequestBody = Record<string, unknown>;

const statuses = new Set<TodoStatus>(["new", "in_progress", "done"]);
const priorities = new Set<Priority>(["low", "medium", "high", "urgent"]);
const storyPointValues = new Set([0, 1, 2, 3, 5, 8, 13, 21, 40]);
const themeModes = new Set<ThemeMode>(["light", "dark", "system"]);
const languages = new Set<Language>(["de", "en"]);

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

function badRequest(message: string) {
  return json({ error: message }, 400);
}

async function readJson(req: Request): Promise<RequestBody> {
  try {
    return (await req.json()) as RequestBody;
  } catch {
    return {};
  }
}

function requiredText(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} is required`);
  }

  return value.trim();
}

function optionalText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function optionalDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  const trimmed = value.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error("dueAt must be a date in YYYY-MM-DD format");
  }

  return trimmed;
}

function parseStatus(value: unknown) {
  if (typeof value !== "string" || !statuses.has(value as TodoStatus)) {
    throw new Error("status must be one of new, in_progress, done");
  }

  return value as TodoStatus;
}

function parsePriority(value: unknown) {
  if (typeof value !== "string" || !priorities.has(value as Priority)) {
    throw new Error("priority must be one of low, medium, high, urgent");
  }

  return value as Priority;
}

function parseStoryPoints(value: unknown) {
  const points = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;

  if (!Number.isInteger(points) || !storyPointValues.has(points)) {
    throw new Error("storyPoints must be one of 0, 1, 2, 3, 5, 8, 13, 21, 40");
  }

  return points;
}

function parseThemeMode(value: unknown) {
  if (typeof value !== "string" || !themeModes.has(value as ThemeMode)) {
    throw new Error("themeMode must be one of light, dark, system");
  }

  return value as ThemeMode;
}

function parseLanguage(value: unknown) {
  if (typeof value !== "string" || !languages.has(value as Language)) {
    throw new Error("language must be one of de, en");
  }

  return value as Language;
}

function parseTags(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((tag): tag is string => typeof tag === "string")
        .map(tag => tag.trim())
        .filter(Boolean)
        .slice(0, 12),
    ),
  );
}

function readTags(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parseTags(parsed);
  } catch {
    return [];
  }
}

function getLists(includeArchived = false) {
  return db
    .query<{ id: number; name: string; createdAt: string; archivedAt: string | null; todoCount: number }, []>(
      `
        SELECT
          todo_lists.id,
          todo_lists.name,
          todo_lists.created_at AS createdAt,
          todo_lists.archived_at AS archivedAt,
          COUNT(CASE WHEN todos.archived_at IS NULL THEN todos.id END) AS todoCount
        FROM todo_lists
        LEFT JOIN todos ON todos.list_id = todo_lists.id
        WHERE ${includeArchived ? "todo_lists.archived_at IS NOT NULL" : "todo_lists.archived_at IS NULL"}
        GROUP BY todo_lists.id
        ORDER BY todo_lists.created_at ASC, todo_lists.id ASC
      `,
    )
    .all();
}

function getPreferences() {
  return db
    .query<{ language: Language; themeMode: ThemeMode }, []>(
      `
        SELECT
          language,
          theme_mode AS themeMode
        FROM app_preferences
        WHERE id = 1
      `,
    )
    .get();
}

function getSubtasks(todoId: number) {
  return db
    .query<{ id: number; todoId: number; title: string; done: number; createdAt: string }, [number]>(
      `
        SELECT
          id,
          todo_id AS todoId,
          title,
          done,
          created_at AS createdAt
        FROM subtasks
        WHERE todo_id = ?
        ORDER BY done ASC, created_at ASC, id ASC
      `,
    )
    .all(todoId)
    .map(subtask => ({ ...subtask, done: Boolean(subtask.done) }));
}

function getActivity(todoId: number) {
  return db
    .query(
      `
        SELECT
          id,
          list_id AS listId,
          todo_id AS todoId,
          action,
          detail,
          created_at AS createdAt
        FROM todo_activity
        WHERE todo_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT 100
      `,
    )
    .all(todoId);
}

function getTodos(listId: number, archiveMode: "active" | "archived" | "all" = "active") {
  const archiveClause =
    archiveMode === "all" ? "1 = 1" : archiveMode === "archived" ? "archived_at IS NOT NULL" : "archived_at IS NULL";
  const rows = db
    .query<{ id: number; tags: string }, [number]>(
      `
        SELECT
          id,
          list_id AS listId,
          title,
          description,
          status,
          priority,
          story_points AS storyPoints,
          due_at AS dueAt,
          archived_at AS archivedAt,
          tags,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM todos
        WHERE list_id = ?
          AND ${archiveClause}
        ORDER BY
          CASE status
            WHEN 'new' THEN 1
            WHEN 'in_progress' THEN 2
            ELSE 3
          END,
          CASE priority
            WHEN 'urgent' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            ELSE 4
          END,
          due_at = '',
          due_at ASC,
          created_at ASC,
          id ASC
      `,
    )
    .all(listId);

  return rows.map(row => ({
    ...row,
    tags: readTags(row.tags),
    subtasks: getSubtasks(row.id),
    activity: getActivity(row.id),
  }));
}

function getTodoContext(todoId: number) {
  return (
    db
      .query<{ listId: number; listArchivedAt: string | null }, [number]>(
        `
          SELECT
            todos.list_id AS listId,
            todo_lists.archived_at AS listArchivedAt
          FROM todos
          JOIN todo_lists ON todo_lists.id = todos.list_id
          WHERE todos.id = ?
        `,
      )
      .get(todoId) ?? null
  );
}

function getEditableTodoContext(todoId: number) {
  const context = getTodoContext(todoId);

  if (!context) {
    return null;
  }

  if (context.listArchivedAt) {
    throw new Error("archived lists are read-only");
  }

  return context;
}

function logActivity(listId: number, todoId: number | null, action: string, detail = "") {
  db.query("INSERT INTO todo_activity (list_id, todo_id, action, detail) VALUES (?, ?, ?, ?)").run(
    listId,
    todoId,
    action,
    detail,
  );
}

async function handleApi(req: Request) {
  const url = new URL(req.url);
  const archivedParam = url.searchParams.get("archived");
  const includeArchived = archivedParam === "1";
  const archiveMode = archivedParam === "all" ? "all" : archivedParam === "1" ? "archived" : "active";
  const listMatch = url.pathname.match(/^\/api\/lists\/(\d+)$/);
  const listTodosMatch = url.pathname.match(/^\/api\/lists\/(\d+)\/todos$/);
  const todoMatch = url.pathname.match(/^\/api\/todos\/(\d+)$/);
  const todoSubtasksMatch = url.pathname.match(/^\/api\/todos\/(\d+)\/subtasks$/);
  const todoActivityMatch = url.pathname.match(/^\/api\/todos\/(\d+)\/activity$/);
  const subtaskMatch = url.pathname.match(/^\/api\/subtasks\/(\d+)$/);

  try {
    if (url.pathname === "/api/preferences" && req.method === "GET") {
      return json(getPreferences());
    }

    if (url.pathname === "/api/preferences" && req.method === "PATCH") {
      const body = await readJson(req);
      const current = getPreferences() ?? { language: "de" as const, themeMode: "system" as const };
      const language = body.language === undefined ? current.language : parseLanguage(body.language);
      const themeMode = body.themeMode === undefined ? current.themeMode : parseThemeMode(body.themeMode);

      db.query("UPDATE app_preferences SET language = ?, theme_mode = ? WHERE id = 1").run(language, themeMode);

      return json({ language, themeMode });
    }

    if (url.pathname === "/api/lists" && req.method === "GET") {
      return json({ lists: getLists(includeArchived) });
    }

    if (url.pathname === "/api/lists" && req.method === "POST") {
      const body = await readJson(req);
      const name = requiredText(body.name, "name");
      const result = db.query("INSERT INTO todo_lists (name) VALUES (?)").run(name);
      const id = Number(result.lastInsertRowid);

      logActivity(id, null, "list-created", name);

      return json({ id, name, archivedAt: null, todoCount: 0 }, 201);
    }

    if (listMatch && req.method === "PATCH") {
      const listId = Number(listMatch[1]);
      const body = await readJson(req);
      const current = db
        .query<{ name: string; archivedAt: string | null }, [number]>(
          "SELECT name, archived_at AS archivedAt FROM todo_lists WHERE id = ?",
        )
        .get(listId);

      if (!current) {
        return json({ error: "List not found" }, 404);
      }

      if (current.archivedAt && body.archived !== false) {
        return json({ error: "archived lists are read-only" }, 400);
      }

      const name = body.name === undefined ? current.name : requiredText(body.name, "name");
      const archivedAt =
        typeof body.archived === "boolean" ? (body.archived ? "CURRENT_TIMESTAMP" : "NULL") : "archived_at";

      db.query(`UPDATE todo_lists SET name = ?, archived_at = ${archivedAt} WHERE id = ?`).run(name, listId);
      logActivity(listId, null, body.archived === true ? "list-archived" : body.archived === false ? "list-restored" : "list-renamed", name);

      return json({ id: listId, name });
    }

    if (listMatch && req.method === "DELETE") {
      const listId = Number(listMatch[1]);
      const result = db.query("UPDATE todo_lists SET archived_at = CURRENT_TIMESTAMP WHERE id = ?").run(listId);

      if (!result.changes) {
        return json({ error: "List not found" }, 404);
      }

      logActivity(listId, null, "list-archived");

      return json({ ok: true });
    }

    if (listTodosMatch && req.method === "GET") {
      const listId = Number(listTodosMatch[1]);
      const list = db.query("SELECT id FROM todo_lists WHERE id = ?").get(listId);

      if (!list) {
        return json({ error: "List not found" }, 404);
      }

      return json({ todos: getTodos(listId, archiveMode) });
    }

    if (listTodosMatch && req.method === "POST") {
      const listId = Number(listTodosMatch[1]);
      const body = await readJson(req);
      const title = requiredText(body.title, "title");
      const description = optionalText(body.description);
      const status = body.status ? parseStatus(body.status) : "new";
      const priority = body.priority ? parsePriority(body.priority) : "medium";
      const storyPoints = body.storyPoints === undefined ? 0 : parseStoryPoints(body.storyPoints);
      const dueAt = optionalDate(body.dueAt);
      const tags = parseTags(body.tags);
      const list = db.query("SELECT id FROM todo_lists WHERE id = ? AND archived_at IS NULL").get(listId);

      if (!list) {
        return json({ error: "List not found" }, 404);
      }

      const result = db
        .query("INSERT INTO todos (list_id, title, description, status, priority, due_at, tags, story_points) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(listId, title, description, status, priority, dueAt, JSON.stringify(tags), storyPoints);
      const id = Number(result.lastInsertRowid);

      logActivity(listId, id, "created", title);

      return json({ id, listId, title, description, status, priority, storyPoints, dueAt, tags, archivedAt: null }, 201);
    }

    if (todoMatch && req.method === "PATCH") {
      const todoId = Number(todoMatch[1]);
      const body = await readJson(req);
      const current = db
        .query<
          {
            listId: number;
            title: string;
            description: string;
            status: TodoStatus;
            priority: Priority;
            storyPoints: number;
            dueAt: string;
            tags: string;
          },
          [number]
        >(
          `
            SELECT
              list_id AS listId,
              title,
              description,
              status,
              priority,
              story_points AS storyPoints,
              due_at AS dueAt,
              tags
            FROM todos
            WHERE id = ?
          `,
        )
        .get(todoId);

      if (!current) {
        return json({ error: "Todo not found" }, 404);
      }

      if (getEditableTodoContext(todoId)?.listId !== current.listId) {
        return json({ error: "Todo not found" }, 404);
      }

      const title = body.title === undefined ? current.title : requiredText(body.title, "title");
      const description = body.description === undefined ? current.description : optionalText(body.description);
      const status = body.status === undefined ? current.status : parseStatus(body.status);
      const priority = body.priority === undefined ? current.priority : parsePriority(body.priority);
      const storyPoints = body.storyPoints === undefined ? current.storyPoints : parseStoryPoints(body.storyPoints);
      const dueAt = body.dueAt === undefined ? current.dueAt : optionalDate(body.dueAt);
      const tags = body.tags === undefined ? readTags(current.tags) : parseTags(body.tags);
      let targetListId = current.listId;

      if (body.listId !== undefined) {
        const parsedListId = Number(body.listId);

        if (!Number.isInteger(parsedListId) || parsedListId < 1) {
          throw new Error("listId must be a valid list id");
        }

        const targetList = db.query("SELECT id FROM todo_lists WHERE id = ? AND archived_at IS NULL").get(parsedListId);

        if (!targetList) {
          return json({ error: "Target list not found" }, 404);
        }

        targetListId = parsedListId;
      }

      const archivedAt =
        typeof body.archived === "boolean" ? (body.archived ? "CURRENT_TIMESTAMP" : "NULL") : "archived_at";

      if (body.archived === true && status !== "done") {
        return json({ error: "Only done todos can be archived" }, 400);
      }

      db.query(
        `
          UPDATE todos
          SET list_id = ?, title = ?, description = ?, status = ?, priority = ?, story_points = ?, due_at = ?, tags = ?, archived_at = ${archivedAt}, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
      ).run(targetListId, title, description, status, priority, storyPoints, dueAt, JSON.stringify(tags), todoId);

      const action =
        targetListId !== current.listId
          ? "moved"
          : body.archived === true
            ? "archived"
            : body.archived === false
              ? "restored"
              : "updated";
      logActivity(targetListId, todoId, action, title);

      return json({ id: todoId, listId: targetListId, title, description, status, priority, storyPoints, dueAt, tags });
    }

    if (todoMatch && req.method === "DELETE") {
      const todoId = Number(todoMatch[1]);
      const context = getEditableTodoContext(todoId);
      const current = db.query<{ status: TodoStatus }, [number]>("SELECT status FROM todos WHERE id = ?").get(todoId);

      if (!context || !current) {
        return json({ error: "Todo not found" }, 404);
      }

      if (current.status !== "done") {
        return json({ error: "Only done todos can be archived" }, 400);
      }

      db.query("UPDATE todos SET archived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(todoId);
      logActivity(context.listId, todoId, "archived");

      return json({ ok: true });
    }

    if (todoSubtasksMatch && req.method === "POST") {
      const todoId = Number(todoSubtasksMatch[1]);
      const context = getEditableTodoContext(todoId);
      const body = await readJson(req);
      const title = requiredText(body.title, "title");

      if (!context) {
        return json({ error: "Todo not found" }, 404);
      }

      const result = db.query("INSERT INTO subtasks (todo_id, title) VALUES (?, ?)").run(todoId, title);
      logActivity(context.listId, todoId, "subtask-added", title);

      return json({ id: Number(result.lastInsertRowid), todoId, title, done: false }, 201);
    }

    if (todoActivityMatch && req.method === "POST") {
      const todoId = Number(todoActivityMatch[1]);
      const context = getEditableTodoContext(todoId);
      const body = await readJson(req);
      const detail = requiredText(body.detail, "detail");

      if (!context) {
        return json({ error: "Todo not found" }, 404);
      }

      logActivity(context.listId, todoId, "note", detail);

      return json({ ok: true }, 201);
    }

    if (subtaskMatch && req.method === "PATCH") {
      const subtaskId = Number(subtaskMatch[1]);
      const body = await readJson(req);
      const current = db
        .query<{ todoId: number; title: string; done: number }, [number]>(
          "SELECT todo_id AS todoId, title, done FROM subtasks WHERE id = ?",
        )
        .get(subtaskId);

      if (!current) {
        return json({ error: "Subtask not found" }, 404);
      }

      const context = getEditableTodoContext(current.todoId);
      if (!context) {
        return json({ error: "Todo not found" }, 404);
      }

      const title = body.title === undefined ? current.title : requiredText(body.title, "title");
      const done = typeof body.done === "boolean" ? (body.done ? 1 : 0) : current.done;

      db.query("UPDATE subtasks SET title = ?, done = ? WHERE id = ?").run(title, done, subtaskId);
      logActivity(context.listId, current.todoId, done ? "subtask-done" : "subtask-open", title);

      return json({ id: subtaskId, todoId: current.todoId, title, done: Boolean(done) });
    }

    if (subtaskMatch && req.method === "DELETE") {
      const subtaskId = Number(subtaskMatch[1]);
      const current = db
        .query<{ todoId: number; title: string }, [number]>("SELECT todo_id AS todoId, title FROM subtasks WHERE id = ?")
        .get(subtaskId);

      if (!current) {
        return json({ error: "Subtask not found" }, 404);
      }

      const context = getEditableTodoContext(current.todoId);
      if (!context) {
        return json({ error: "Todo not found" }, 404);
      }

      db.query("DELETE FROM subtasks WHERE id = ?").run(subtaskId);
      logActivity(context.listId, current.todoId, "subtask-removed", current.title);

      return json({ ok: true });
    }
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "Invalid request");
  }

  if (url.pathname.startsWith("/api/")) {
    return json({ error: "Not found" }, 404);
  }

  return null;
}

async function serveStaticAsset(req: Request) {
  const url = new URL(req.url);
  const normalizedPath = path.normalize(url.pathname).replace(/^[/\\]+/, "");
  const relativePath = normalizedPath === "" || normalizedPath === "." ? "index.html" : normalizedPath;
  const filePath = path.resolve(distDir, relativePath);

  if (filePath !== distDir && !filePath.startsWith(`${distDir}${path.sep}`)) {
    return new Response("Forbidden", { status: 403 });
  }

  let file = Bun.file(filePath);

  if (!(await file.exists())) {
    file = Bun.file(path.join(distDir, "index.html"));
  }

  if (!(await file.exists())) {
    return new Response("Run `bun run build` before `bun start`.", { status: 404 });
  }

  return new Response(file, {
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
  });
}

const server = Bun.serve({
  hostname: process.env.HOST ?? "0.0.0.0",
  port: Number(process.env.PORT ?? 3000),
  async fetch(req) {
    const apiResponse = await handleApi(req);

    if (apiResponse) {
      return apiResponse;
    }

    if (!shouldServeStatic) {
      return json(
        {
          message: "Bun API server is running.",
          frontend: "Run `bun dev` and open http://localhost:5173",
        },
        404,
      );
    }

    return serveStaticAsset(req);
  },
});

console.log(`${shouldServeStatic ? "Production server" : "API server"} running at ${server.url}`);
