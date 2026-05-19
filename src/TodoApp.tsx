import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Archive,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  Edit3,
  Filter,
  Inbox,
  ListTodo,
  Minus,
  Plus,
  RotateCcw,
  Search,
  Tags,
  Trash2,
  X,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type TodoStatus = "new" | "in_progress" | "done";
type Priority = "low" | "medium" | "high" | "urgent";
type StoryPoints = 0 | 1 | 2 | 3 | 5 | 8 | 13 | 21 | 40;
type DueFilter = "all" | "today" | "overdue";
type SortMode = "status" | "priority" | "due" | "updated";
type ThemeMode = "light" | "dark" | "system";

type TodoList = {
  id: number;
  name: string;
  createdAt?: string;
  archivedAt?: string | null;
  todoCount: number;
};

type Subtask = {
  id: number;
  todoId: number;
  title: string;
  done: boolean;
};

type Activity = {
  id: number;
  action: string;
  detail: string;
  createdAt: string;
};

type Todo = {
  id: number;
  listId: number;
  title: string;
  description: string;
  status: TodoStatus;
  priority: Priority;
  storyPoints: StoryPoints;
  dueAt: string;
  archivedAt?: string | null;
  tags: string[];
  subtasks: Subtask[];
  activity: Activity[];
  createdAt?: string;
  updatedAt?: string;
};

type TodoPatch = Partial<Pick<Todo, "title" | "description" | "status" | "priority" | "storyPoints" | "dueAt" | "tags">> & {
  archived?: boolean;
  listId?: number;
};

const lanes: Array<{
  status: TodoStatus;
  title: string;
  icon: typeof Circle;
  tone: string;
}> = [
  {
    status: "new",
    title: "Neu",
    icon: Circle,
    tone: "border-sky-200 bg-sky-50/70 text-sky-950 dark:border-sky-900/70 dark:bg-sky-950/35 dark:text-sky-100",
  },
  {
    status: "in_progress",
    title: "In Bearbeitung",
    icon: Clock3,
    tone: "border-amber-200 bg-amber-50/70 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100",
  },
  {
    status: "done",
    title: "Erledigt",
    icon: CheckCircle2,
    tone:
      "border-emerald-200 bg-emerald-50/70 text-emerald-950 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-100",
  },
];

const statusOrder: TodoStatus[] = ["new", "in_progress", "done"];
const priorityOrder: Priority[] = ["urgent", "high", "medium", "low"];
const priorityLabels: Record<Priority, string> = {
  low: "Niedrig",
  medium: "Normal",
  high: "Hoch",
  urgent: "Dringend",
};
const storyPointOptions: StoryPoints[] = [0, 1, 2, 3, 5, 8, 13, 21, 40];
const actionLabels: Record<string, string> = {
  archived: "Archiviert",
  created: "Erstellt",
  note: "Notiz",
  restored: "Wiederhergestellt",
  "subtask-added": "Teilschritt hinzugefügt",
  "subtask-done": "Teilschritt erledigt",
  "subtask-open": "Teilschritt geöffnet",
  "subtask-removed": "Teilschritt entfernt",
  moved: "Verschoben",
  updated: "Bearbeitet",
};

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

function tagsFromInput(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map(tag => tag.trim())
        .filter(Boolean),
    ),
  );
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function isOverdue(todo: Todo) {
  return Boolean(todo.dueAt && todo.dueAt < todayDate() && todo.status !== "done");
}

function shortDate(value: string) {
  if (!value) {
    return "Ohne Datum";
  }

  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" }).format(new Date(`${value}T12:00:00`));
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
      {label}
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-xs outline-none transition-colors focus-visible:border-slate-950 focus-visible:ring-2 focus-visible:ring-slate-950/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus-visible:border-slate-300 dark:focus-visible:ring-slate-300/10"
      >
        {children}
      </select>
    </label>
  );
}

function DueDateField({
  dueAt,
  id,
  inline = false,
  label = "Fällig",
  setDueAt,
  setWithoutDue,
  withoutDue,
}: {
  dueAt: string;
  id: string;
  inline?: boolean;
  label?: string;
  setDueAt: (value: string) => void;
  setWithoutDue: (value: boolean) => void;
  withoutDue: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
      <Label htmlFor={id} className="text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
      </Label>
      <div className={cn("grid gap-2", inline && "sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center")}>
        <Input
          id={id}
          type="date"
          value={dueAt}
          onChange={event => setDueAt(event.target.value)}
          disabled={withoutDue}
          className="min-w-0"
        />
        <label className="flex min-h-9 items-center gap-2 whitespace-nowrap rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-normal text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          <input
            type="checkbox"
            checked={withoutDue}
            onChange={event => {
              setWithoutDue(event.target.checked);
              if (event.target.checked) {
                setDueAt("");
              } else if (!dueAt) {
                setDueAt(todayDate());
              }
            }}
          />
          Ohne Fälligkeit
        </label>
      </div>
    </div>
  );
}

function ThemeSelect({ themeMode, setThemeMode }: { themeMode: ThemeMode; setThemeMode: (mode: ThemeMode) => void }) {
  const modes: Array<{ mode: ThemeMode; label: string; symbol: string }> = [
    { mode: "light", label: "Tag", symbol: "☀" },
    { mode: "dark", label: "Nacht", symbol: "☾" },
    { mode: "system", label: "System", symbol: "◐" },
  ];

  return (
    <div className="sm:border-l sm:border-slate-200 sm:pl-3 dark:sm:border-slate-800">
      <div className="relative">
        <Label htmlFor="theme-mode" className="sr-only">
          Design
        </Label>
        <select
          id="theme-mode"
          value={themeMode}
          onChange={event => setThemeMode(event.target.value as ThemeMode)}
          className="h-9 w-16 appearance-none rounded-md border border-slate-200 bg-white pr-7 pl-3 text-center text-lg font-medium text-slate-900 shadow-xs outline-none transition-colors hover:border-slate-300 focus-visible:border-slate-950 focus-visible:ring-2 focus-visible:ring-slate-950/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-600 dark:focus-visible:border-slate-300 dark:focus-visible:ring-slate-300/10"
          aria-label="Design"
          title="Design"
        >
          {modes.map(({ mode, label, symbol }) => (
            <option key={mode} value={mode} aria-label={label}>
              {symbol}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 text-slate-400" />
      </div>
    </div>
  );
}

export function TodoApp() {
  const [lists, setLists] = useState<TodoList[]>([]);
  const [archivedLists, setArchivedLists] = useState<TodoList[]>([]);
  const [archiveListsExpanded, setArchiveListsExpanded] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }

    return window.localStorage.getItem("todo-archive-lists-expanded") !== "false";
  });
  const [showAllTodos, setShowAllTodos] = useState(false);
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newListName, setNewListName] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [newTodoPriority, setNewTodoPriority] = useState<Priority>("medium");
  const [newTodoStoryPoints, setNewTodoStoryPoints] = useState<StoryPoints>(0);
  const [newTodoDueAt, setNewTodoDueAt] = useState("");
  const [newTodoWithoutDue, setNewTodoWithoutDue] = useState(true);
  const [newTodoTags, setNewTodoTags] = useState("");
  const [newTodoDialogOpen, setNewTodoDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | TodoStatus>("all");
  const [filterPriority, setFilterPriority] = useState<"all" | Priority>("all");
  const [filterTag, setFilterTag] = useState("all");
  const [dueFilter, setDueFilter] = useState<DueFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("status");
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") {
      return "system";
    }

    const stored = window.localStorage.getItem("todo-theme");
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  });
  const [editingTodoId, setEditingTodoId] = useState<number | null>(null);
  const [draggedTodoId, setDraggedTodoId] = useState<number | null>(null);
  const [lastUndo, setLastUndo] = useState<{ label: string; run: () => Promise<void> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const selectedList = useMemo(
    () => [...lists, ...archivedLists].find(list => list.id === selectedListId) ?? null,
    [archivedLists, lists, selectedListId],
  );
  const isArchivedList = Boolean(selectedList?.archivedAt);

  const availableTags = useMemo(() => Array.from(new Set(todos.flatMap(todo => todo.tags))).sort(), [todos]);

  const dashboard = useMemo(() => {
    const active = todos.filter(todo => !todo.archivedAt);

    return {
      open: active.filter(todo => todo.status !== "done").length,
      dueToday: active.filter(todo => todo.dueAt === todayDate()).length,
      overdue: active.filter(isOverdue).length,
      urgent: active.filter(todo => todo.priority === "urgent" && todo.status !== "done").length,
    };
  }, [todos]);

  const filteredTodos = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return todos
      .filter(todo => {
        const matchesSearch =
          !normalizedSearch ||
          [todo.title, todo.description, todo.tags.join(" ")]
            .join(" ")
            .toLowerCase()
            .includes(normalizedSearch);
        const matchesStatus = filterStatus === "all" || todo.status === filterStatus;
        const matchesPriority = filterPriority === "all" || todo.priority === filterPriority;
        const matchesTag = filterTag === "all" || todo.tags.includes(filterTag);
        const matchesDue =
          dueFilter === "all" ||
          (dueFilter === "today" && todo.dueAt === todayDate()) ||
          (dueFilter === "overdue" && isOverdue(todo));

        return matchesSearch && matchesStatus && matchesPriority && matchesTag && matchesDue;
      })
      .sort((a, b) => {
        if (sortMode === "priority") {
          return priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority);
        }

        if (sortMode === "due") {
          return (a.dueAt || "9999-99-99").localeCompare(b.dueAt || "9999-99-99");
        }

        if (sortMode === "updated") {
          return String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? ""));
        }

        return statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
      });
  }, [dueFilter, filterPriority, filterStatus, filterTag, searchQuery, sortMode, todos]);

  const todosByStatus = useMemo(
    () =>
      lanes.reduce(
        (grouped, lane) => {
          const laneTodos =
            lane.status === "done"
              ? filteredTodos.filter(todo => todo.status === "done" || todo.archivedAt)
              : filteredTodos.filter(todo => todo.status === lane.status && !todo.archivedAt);

          grouped[lane.status] = laneTodos.sort((a, b) => Number(Boolean(a.archivedAt)) - Number(Boolean(b.archivedAt)));
          return grouped;
        },
        {} as Record<TodoStatus, Todo[]>,
      ),
    [filteredTodos],
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    function applyTheme() {
      const shouldUseDark = themeMode === "dark" || (themeMode === "system" && mediaQuery.matches);
      document.documentElement.classList.toggle("dark", shouldUseDark);
      document.documentElement.style.colorScheme = shouldUseDark ? "dark" : "light";
    }

    window.localStorage.setItem("todo-theme", themeMode);
    applyTheme();
    mediaQuery.addEventListener("change", applyTheme);

    return () => mediaQuery.removeEventListener("change", applyTheme);
  }, [themeMode]);

  useEffect(() => {
    window.localStorage.setItem("todo-archive-lists-expanded", String(archiveListsExpanded));
  }, [archiveListsExpanded]);

  const loadLists = useCallback(async () => {
    const [activeData, archivedData] = await Promise.all([
      api<{ lists: TodoList[] }>("/api/lists"),
      api<{ lists: TodoList[] }>("/api/lists?archived=1"),
    ]);

    setLists(activeData.lists);
    setArchivedLists(archivedData.lists);
    setSelectedListId(current => {
      const combined = [...activeData.lists, ...archivedData.lists];

      if (current && combined.some(list => list.id === current)) {
        return current;
      }

      return activeData.lists[0]?.id ?? archivedData.lists[0]?.id ?? null;
    });
  }, []);

  const loadTodos = useCallback(async (listId: number, showAll = showAllTodos) => {
    const data = await api<{ todos: Todo[] }>(`/api/lists/${listId}/todos${showAll ? "?archived=all" : ""}`);
    setTodos(data.todos);
  }, [showAllTodos]);

  const reloadSelected = useCallback(async () => {
    if (!selectedListId) {
      return;
    }

    await Promise.all([loadTodos(selectedListId), loadLists()]);
  }, [loadLists, loadTodos, selectedListId]);

  useEffect(() => {
    void loadLists()
      .catch(error => setError(error instanceof Error ? error.message : "Listen konnten nicht geladen werden."))
      .finally(() => setLoading(false));
  }, [loadLists]);

  useEffect(() => {
    if (!selectedListId) {
      setTodos([]);
      return;
    }

    setRenameValue(selectedList?.name ?? "");
    setEditingTodoId(null);
    void loadTodos(selectedListId).catch(error =>
      setError(error instanceof Error ? error.message : "ToDos konnten nicht geladen werden."),
    );
  }, [loadTodos, selectedList?.archivedAt, selectedList?.name, selectedListId, showAllTodos]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT";

      if (event.key === "Escape") {
        setNewTodoDialogOpen(false);
        setEditingTodoId(null);
        return;
      }

      if (typing) {
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }

      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        if (selectedListId && !isArchivedList) {
          setNewTodoDialogOpen(true);
        }
      }

    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isArchivedList, selectedListId]);

  useEffect(() => {
    if (newTodoDialogOpen) {
      window.setTimeout(() => titleInputRef.current?.focus(), 0);
    }
  }, [newTodoDialogOpen]);

  async function createList(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = newListName.trim();

    if (!name) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const created = await api<TodoList>("/api/lists", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setNewListName("");
      await loadLists();
      setSelectedListId(created.id);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Liste konnte nicht angelegt werden.");
    } finally {
      setSaving(false);
    }
  }

  async function renameList(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!selectedListId || !renameValue.trim()) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await api(`/api/lists/${selectedListId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: renameValue }),
      });
      await loadLists();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Liste konnte nicht umbenannt werden.");
    } finally {
      setSaving(false);
    }
  }

  async function archiveList(archived: boolean) {
    if (!selectedListId) {
      return;
    }

    const listId = selectedListId;
    setSaving(true);
    setError(null);

    try {
      await api(`/api/lists/${listId}`, {
        method: "PATCH",
        body: JSON.stringify({ archived }),
      });
      setLastUndo({
        label: archived ? "Liste wiederherstellen" : "Archivierung erneut setzen",
        run: async () => {
          await api(`/api/lists/${listId}`, {
            method: "PATCH",
            body: JSON.stringify({ archived: !archived }),
          });
          setSelectedListId(listId);
          await Promise.all([loadLists(), loadTodos(listId)]);
        },
      });
      setSelectedListId(listId);
      await Promise.all([loadLists(), loadTodos(listId)]);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Liste konnte nicht archiviert werden.");
    } finally {
      setSaving(false);
    }
  }

  async function createTodo(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!selectedListId || isArchivedList) {
      return;
    }

    const form = e.currentTarget;
    const formData = new FormData(form);
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();

    if (!title) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await api(`/api/lists/${selectedListId}/todos`, {
        method: "POST",
        body: JSON.stringify({
          title,
          description,
          priority: newTodoPriority,
          storyPoints: newTodoStoryPoints,
          dueAt: newTodoWithoutDue ? "" : newTodoDueAt || todayDate(),
          tags: tagsFromInput(newTodoTags),
        }),
      });
      form.reset();
      setNewTodoPriority("medium");
      setNewTodoStoryPoints(0);
      setNewTodoDueAt("");
      setNewTodoWithoutDue(true);
      setNewTodoTags("");
      setNewTodoDialogOpen(false);
      await reloadSelected();
    } catch (error) {
      setError(error instanceof Error ? error.message : "ToDo konnte nicht angelegt werden.");
    } finally {
      setSaving(false);
    }
  }

  async function updateTodoStatus(todo: Todo, direction: -1 | 1) {
    if (isArchivedList) {
      return;
    }

    const currentIndex = statusOrder.indexOf(todo.status);
    const nextStatus = statusOrder[currentIndex + direction];

    if (!nextStatus) {
      return;
    }

    await patchTodo(todo.id, { status: nextStatus });
  }

  async function patchTodo(todoId: number, patch: TodoPatch) {
    if (isArchivedList) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await api(`/api/todos/${todoId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      await reloadSelected();
    } catch (error) {
      setError(error instanceof Error ? error.message : "ToDo konnte nicht aktualisiert werden.");
    } finally {
      setSaving(false);
    }
  }

  async function archiveTodo(todo: Todo, archived: boolean) {
    if (isArchivedList) {
      return;
    }

    await patchTodo(todo.id, { archived });
    setLastUndo({
      label: archived ? "ToDo wiederherstellen" : "ToDo erneut archivieren",
      run: async () => {
        await api(`/api/todos/${todo.id}`, {
          method: "PATCH",
          body: JSON.stringify({ archived: !archived }),
        });
        await reloadSelected();
      },
    });
  }

  async function createSubtask(todoId: number, title: string) {
    if (isArchivedList) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await api(`/api/todos/${todoId}/subtasks`, {
        method: "POST",
        body: JSON.stringify({ title }),
      });
      await reloadSelected();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Teilschritt konnte nicht angelegt werden.");
    } finally {
      setSaving(false);
    }
  }

  async function patchSubtask(subtaskId: number, done: boolean) {
    if (isArchivedList) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await api(`/api/subtasks/${subtaskId}`, {
        method: "PATCH",
        body: JSON.stringify({ done }),
      });
      await reloadSelected();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Teilschritt konnte nicht geändert werden.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSubtask(subtaskId: number) {
    if (isArchivedList) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await api(`/api/subtasks/${subtaskId}`, { method: "DELETE" });
      await reloadSelected();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Teilschritt konnte nicht gelöscht werden.");
    } finally {
      setSaving(false);
    }
  }

  async function addNote(todoId: number, detail: string) {
    if (isArchivedList) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await api(`/api/todos/${todoId}/activity`, {
        method: "POST",
        body: JSON.stringify({ detail }),
      });
      await reloadSelected();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Notiz konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

  async function runUndo() {
    if (!lastUndo) {
      return;
    }

    const undo = lastUndo;
    setLastUndo(null);
    setSaving(true);

    try {
      await undo.run();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Rückgängig konnte nicht ausgeführt werden.");
    } finally {
      setSaving(false);
    }
  }

  function renderListButton(list: TodoList, archived = false) {
    return (
      <button
        key={list.id}
        type="button"
        onClick={() => setSelectedListId(list.id)}
        className={cn(
          "flex min-w-56 items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors lg:min-w-0",
          selectedListId === list.id
            ? "border-slate-950 bg-slate-950 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950"
            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600",
        )}
      >
        <span className="truncate font-medium">{list.name}</span>
        <span
          className={cn(
            "ml-3 rounded-full px-2 py-0.5 text-xs",
            selectedListId === list.id
              ? "bg-white/15 text-white dark:bg-slate-950/10 dark:text-slate-950"
              : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
          )}
        >
          {archived ? <Archive className="size-3" /> : list.todoCount}
        </span>
      </button>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f7f3] text-slate-950 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-[1480px] flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Aufgabenboard</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal text-slate-950 dark:text-slate-50">Listen & ToDos</h1>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end md:w-auto">
            <form onSubmit={createList} className="flex w-full gap-2 sm:max-w-md">
              <Label htmlFor="list-name" className="sr-only">
                Neue Liste
              </Label>
              <Input
                id="list-name"
                value={newListName}
                onChange={event => setNewListName(event.target.value)}
                placeholder="Neue Liste"
                className="bg-white dark:bg-slate-900"
              />
              <Button type="submit" disabled={saving || !newListName.trim()}>
                <Plus />
                Liste
              </Button>
            </form>
            <ThemeSelect themeMode={themeMode} setThemeMode={setThemeMode} />
          </div>
        </header>

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">{error}</div>
        ) : null}
        {lastUndo ? (
          <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
            <span>Letzte Änderung kann rückgängig gemacht werden.</span>
            <Button type="button" variant="outline" size="sm" onClick={() => void runUndo()} disabled={saving}>
              <RotateCcw />
              {lastUndo.label}
            </Button>
          </div>
        ) : null}

        <div className="grid flex-1 gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="flex flex-col gap-3 border-b border-slate-200 pb-4 dark:border-slate-800 lg:border-r lg:border-b-0 lg:pr-6 lg:pb-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <ListTodo className="size-4" />
              Listen
            </div>

            <div className="flex flex-col gap-4">
              <section className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Aktiv
                  </h2>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200">
                    {lists.length}
                  </span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
                  {loading ? <p className="text-sm text-slate-500 dark:text-slate-400">Lade Listen...</p> : null}
                  {!loading && lists.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">Noch keine aktiven Listen.</p>
                  ) : null}
                  {lists.map(list => renderListButton(list))}
                </div>
              </section>

              <section className="flex flex-col gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Archiv
                  </h2>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => setArchiveListsExpanded(current => !current)}
                    className="border-amber-300 text-amber-800 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-950/40"
                    aria-label={archiveListsExpanded ? "Archiv ausblenden" : "Archiv einblenden"}
                    title={archiveListsExpanded ? "Archiv ausblenden" : "Archiv einblenden"}
                  >
                    {archiveListsExpanded ? <Minus /> : <Plus />}
                  </Button>
                </div>
                {archiveListsExpanded ? (
                  <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
                    {!loading && archivedLists.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">Kein Listenarchiv.</p>
                    ) : null}
                    {archivedLists.map(list => renderListButton(list, true))}
                  </div>
                ) : null}
              </section>
            </div>
          </aside>

          <section className="flex min-w-0 flex-col gap-5">
            {selectedList ? (
              <>
                <div className="grid gap-3 md:grid-cols-4">
                  <Metric icon={Inbox} label="Offen" value={dashboard.open} />
                  <Metric icon={CalendarDays} label="Heute" value={dashboard.dueToday} />
                  <Metric icon={Clock3} label="Überfällig" value={dashboard.overdue} tone={dashboard.overdue ? "text-red-700" : ""} />
                  <Metric icon={Filter} label="Dringend" value={dashboard.urgent} tone={dashboard.urgent ? "text-amber-700" : ""} />
                </div>

                <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-end md:justify-between">
                  <form onSubmit={renameList} className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                    <Label htmlFor="rename-list" className="shrink-0 text-sm text-slate-500 dark:text-slate-400">
                      Aktive Liste
                    </Label>
                    <Input
                      id="rename-list"
                      value={renameValue}
                      onChange={event => setRenameValue(event.target.value)}
                      className="max-w-xl"
                      disabled={isArchivedList}
                    />
                    <Button
                      type="submit"
                      variant="secondary"
                      disabled={saving || isArchivedList || !renameValue.trim() || renameValue === selectedList.name}
                    >
                      Speichern
                    </Button>
                  </form>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void archiveList(!isArchivedList)}
                    disabled={saving}
                  >
                    {isArchivedList ? <RotateCcw /> : <Archive />}
                    {isArchivedList ? "Liste wiederherstellen" : "Liste archivieren"}
                  </Button>
                </div>

                {!isArchivedList ? (
                  <div className="flex justify-end">
                    <Button type="button" onClick={() => setNewTodoDialogOpen(true)} disabled={saving}>
                      <Plus />
                      ToDo anlegen
                    </Button>
                  </div>
                ) : null}

                {newTodoDialogOpen ? (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="new-todo-dialog-title"
                    onMouseDown={event => {
                      if (event.target === event.currentTarget) {
                        setNewTodoDialogOpen(false);
                      }
                    }}
                  >
                    <form
                      onSubmit={createTodo}
                      className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-md border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="mb-4 flex items-start justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
                        <div>
                          <h2 id="new-todo-dialog-title" className="text-lg font-semibold text-slate-950 dark:text-slate-50">
                            Neues ToDo
                          </h2>
                          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            {selectedList.name}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setNewTodoDialogOpen(false)}
                          aria-label="Dialog schließen"
                          title="Dialog schließen"
                        >
                          <X />
                        </Button>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="flex flex-col gap-2 md:col-span-2">
                          <Label htmlFor="todo-title">Titel</Label>
                          <Input ref={titleInputRef} id="todo-title" name="title" placeholder="Neue Aufgabe" />
                        </div>
                        <div className="flex flex-col gap-2 md:col-span-2">
                          <Label htmlFor="todo-description">Beschreibung</Label>
                          <Textarea
                            id="todo-description"
                            name="description"
                            placeholder="Optional"
                            className="min-h-24 resize-y"
                          />
                        </div>
                        <SelectField
                          label="Priorität"
                          value={newTodoPriority}
                          onChange={value => setNewTodoPriority(value as Priority)}
                        >
                          {priorityOrder.map(priority => (
                            <option key={priority} value={priority}>
                              {priorityLabels[priority]}
                            </option>
                          ))}
                        </SelectField>
                        <SelectField
                          label="SP"
                          value={String(newTodoStoryPoints)}
                          onChange={value => setNewTodoStoryPoints(Number(value) as StoryPoints)}
                        >
                          {storyPointOptions.map(points => (
                            <option key={points} value={points}>
                              {points}
                            </option>
                          ))}
                        </SelectField>
                        <div className="md:col-span-2">
                          <DueDateField
                            id="todo-due-at"
                            inline
                            dueAt={newTodoDueAt}
                            setDueAt={setNewTodoDueAt}
                            withoutDue={newTodoWithoutDue}
                            setWithoutDue={setNewTodoWithoutDue}
                          />
                        </div>
                        <label className="flex flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 md:col-span-2">
                          Tags
                          <Input value={newTodoTags} onChange={event => setNewTodoTags(event.target.value)} placeholder="Arbeit, Idee" />
                        </label>
                      </div>

                      <div className="mt-5 flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
                        <Button type="button" variant="ghost" onClick={() => setNewTodoDialogOpen(false)}>
                          Abbrechen
                        </Button>
                        <Button type="submit" disabled={saving}>
                          <Plus />
                          ToDo anlegen
                        </Button>
                      </div>
                    </form>
                  </div>
                ) : null}

                <div className="grid gap-3 rounded-md border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 xl:grid-cols-[1.5fr_repeat(5,minmax(120px,1fr))_auto] xl:items-end">
                  <label className="flex flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                    Suche
                    <span className="relative">
                      <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        ref={searchInputRef}
                        value={searchQuery}
                        onChange={event => setSearchQuery(event.target.value)}
                        placeholder="Titel, Text, Tags"
                        className="pl-9"
                      />
                    </span>
                  </label>
                  <SelectField label="Status" value={filterStatus} onChange={value => setFilterStatus(value as "all" | TodoStatus)}>
                    <option value="all">Alle</option>
                    {lanes.map(lane => (
                      <option key={lane.status} value={lane.status}>
                        {lane.title}
                      </option>
                    ))}
                  </SelectField>
                  <SelectField
                    label="Priorität"
                    value={filterPriority}
                    onChange={value => setFilterPriority(value as "all" | Priority)}
                  >
                    <option value="all">Alle</option>
                    {priorityOrder.map(priority => (
                      <option key={priority} value={priority}>
                        {priorityLabels[priority]}
                      </option>
                    ))}
                  </SelectField>
                  <SelectField label="Fälligkeit" value={dueFilter} onChange={value => setDueFilter(value as DueFilter)}>
                    <option value="all">Alle</option>
                    <option value="today">Heute</option>
                    <option value="overdue">Überfällig</option>
                  </SelectField>
                  <SelectField label="Tag" value={filterTag} onChange={setFilterTag}>
                    <option value="all">Alle</option>
                    {availableTags.map(tag => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </SelectField>
                  <SelectField label="Sortierung" value={sortMode} onChange={value => setSortMode(value as SortMode)}>
                    <option value="status">Status</option>
                    <option value="priority">Priorität</option>
                    <option value="due">Fällig</option>
                    <option value="updated">Zuletzt geändert</option>
                  </SelectField>
                  <Button
                    type="button"
                    variant={showAllTodos ? "secondary" : "outline"}
                    onClick={() => setShowAllTodos(current => !current)}
                    className={cn(
                      showAllTodos
                        ? "border-amber-500 bg-amber-500 text-white hover:bg-amber-600 dark:border-amber-400 dark:bg-amber-500 dark:text-slate-950 dark:hover:bg-amber-400"
                        : "border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600 dark:border-emerald-400 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400",
                    )}
                  >
                    <Archive />
                    {showAllTodos ? "Alle" : "Aktiv"}
                  </Button>
                </div>

                <div className="grid gap-4 xl:grid-cols-3">
                  {lanes.map(lane => {
                    const LaneIcon = lane.icon;
                    const laneTodos = todosByStatus[lane.status];

                    return (
                      <section
                        key={lane.status}
                        onDragOver={event => {
                          if (!isArchivedList) {
                            event.preventDefault();
                          }
                        }}
                        onDrop={event => {
                          event.preventDefault();
                          const todoId = Number(event.dataTransfer.getData("text/plain") || draggedTodoId);
                          const todo = todos.find(item => item.id === todoId);

                          if (todo && todo.status !== lane.status && !todo.archivedAt && !isArchivedList) {
                            void patchTodo(todo.id, { status: lane.status });
                          }

                          setDraggedTodoId(null);
                        }}
                        className={cn("flex min-h-[360px] flex-col rounded-md border p-3", lane.tone)}
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <LaneIcon className="size-4" />
                            <h2 className="text-sm font-semibold">{lane.title}</h2>
                          </div>
                          <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-medium dark:bg-slate-950/40">
                            {laneTodos.length}
                          </span>
                        </div>

                        <div className="flex flex-1 flex-col gap-3">
                          {laneTodos.length === 0 ? (
                            <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-current/20 bg-white/35 p-6 text-center text-sm opacity-70 dark:bg-slate-950/20">
                              Keine ToDos
                            </div>
                          ) : null}

                          {laneTodos.map(todo => (
                            <TodoCard
                              key={todo.id}
                              todo={todo}
                              activeLists={lists}
                              saving={saving}
                              listReadOnly={isArchivedList}
                              editing={editingTodoId === todo.id}
                              onEdit={() => setEditingTodoId(todo.id)}
                              onCancelEdit={() => setEditingTodoId(null)}
                              onSaveEdit={patch => {
                                setEditingTodoId(null);
                                void patchTodo(todo.id, patch);
                              }}
                              onArchive={archived => void archiveTodo(todo, archived)}
                              onMove={direction => void updateTodoStatus(todo, direction)}
                              onMoveToList={listId => void patchTodo(todo.id, { listId })}
                              onDragStart={event => {
                                if (isArchivedList) {
                                  event.preventDefault();
                                  return;
                                }

                                setDraggedTodoId(todo.id);
                                event.dataTransfer.effectAllowed = "move";
                                event.dataTransfer.setData("text/plain", String(todo.id));
                              }}
                              onCreateSubtask={title => void createSubtask(todo.id, title)}
                              onPatchSubtask={(subtaskId, done) => void patchSubtask(subtaskId, done)}
                              onDeleteSubtask={subtaskId => void deleteSubtask(subtaskId)}
                              onAddNote={detail => void addNote(todo.id, detail)}
                            />
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex min-h-[420px] items-center justify-center rounded-md border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                Lege eine Liste an, um dein erstes Kanban-Board zu starten.
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Inbox;
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <Icon className="size-4" />
        {label}
      </div>
      <strong className={cn("text-xl font-semibold text-slate-950 dark:text-slate-50", tone)}>{value}</strong>
    </div>
  );
}

function TodoCard({
  todo,
  activeLists,
  saving,
  listReadOnly,
  editing,
  onEdit,
  onCancelEdit,
  onSaveEdit,
  onArchive,
  onMove,
  onMoveToList,
  onDragStart,
  onCreateSubtask,
  onPatchSubtask,
  onDeleteSubtask,
  onAddNote,
}: {
  todo: Todo;
  activeLists: TodoList[];
  saving: boolean;
  listReadOnly: boolean;
  editing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (patch: TodoPatch) => void;
  onArchive: (archived: boolean) => void;
  onMove: (direction: -1 | 1) => void;
  onMoveToList: (listId: number) => void;
  onDragStart: React.DragEventHandler<HTMLElement>;
  onCreateSubtask: (title: string) => void;
  onPatchSubtask: (subtaskId: number, done: boolean) => void;
  onDeleteSubtask: (subtaskId: number) => void;
  onAddNote: (detail: string) => void;
}) {
  const [title, setTitle] = useState(todo.title);
  const [description, setDescription] = useState(todo.description);
  const [priority, setPriority] = useState<Priority>(todo.priority);
  const [storyPoints, setStoryPoints] = useState<StoryPoints>(todo.storyPoints);
  const [dueAt, setDueAt] = useState(todo.dueAt);
  const [withoutDue, setWithoutDue] = useState(!todo.dueAt);
  const [tagsValue, setTagsValue] = useState(todo.tags.join(", "));
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [note, setNote] = useState("");
  const [moveTargetListId, setMoveTargetListId] = useState("");
  const doneSubtasks = todo.subtasks.filter(subtask => subtask.done).length;
  const isArchivedTodo = Boolean(todo.archivedAt);
  const readOnly = isArchivedTodo || listReadOnly;
  const targetLists = activeLists.filter(list => list.id !== todo.listId);

  useEffect(() => {
    if (editing) {
      setTitle(todo.title);
      setDescription(todo.description);
      setPriority(todo.priority);
      setStoryPoints(todo.storyPoints);
      setDueAt(todo.dueAt);
      setWithoutDue(!todo.dueAt);
      setTagsValue(todo.tags.join(", "));
    }
  }, [editing, todo.description, todo.dueAt, todo.priority, todo.storyPoints, todo.tags, todo.title]);

  function submitEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!title.trim()) {
      return;
    }

    onSaveEdit({
      title: title.trim(),
      description,
      priority,
      storyPoints,
      dueAt: withoutDue ? "" : dueAt || todayDate(),
      tags: tagsFromInput(tagsValue),
    });
  }

  function submitSubtask(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!subtaskTitle.trim()) {
      return;
    }

    onCreateSubtask(subtaskTitle.trim());
    setSubtaskTitle("");
  }

  function submitNote(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!note.trim()) {
      return;
    }

    onAddNote(note.trim());
    setNote("");
  }

  return (
    <Card
      draggable={!readOnly}
      onDragStart={onDragStart}
      className={cn(
        "gap-3 rounded-md border-white/80 bg-white/95 py-4 shadow-xs dark:border-slate-700 dark:bg-slate-900/95",
        isArchivedTodo &&
          "border-amber-300 bg-amber-50/95 shadow-sm ring-1 ring-amber-200/70 dark:border-amber-500/60 dark:bg-amber-950/35 dark:ring-amber-400/20",
        !readOnly && "cursor-grab active:cursor-grabbing",
      )}
    >
      <CardContent className="flex flex-col gap-3 px-4">
        {editing ? (
          <form onSubmit={submitEdit} className="flex flex-col gap-3">
            <Input value={title} onChange={event => setTitle(event.target.value)} />
            <Textarea value={description} onChange={event => setDescription(event.target.value)} className="min-h-20" />
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_96px]">
              <SelectField label="Priorität" value={priority} onChange={value => setPriority(value as Priority)}>
                {priorityOrder.map(priorityOption => (
                  <option key={priorityOption} value={priorityOption}>
                    {priorityLabels[priorityOption]}
                  </option>
                ))}
              </SelectField>
              <SelectField label="SP" value={String(storyPoints)} onChange={value => setStoryPoints(Number(value) as StoryPoints)}>
                {storyPointOptions.map(points => (
                  <option key={points} value={points}>
                    {points}
                  </option>
                ))}
              </SelectField>
              <DueDateField
                id={`todo-${todo.id}-due-at`}
                dueAt={dueAt}
                setDueAt={setDueAt}
                withoutDue={withoutDue}
                setWithoutDue={setWithoutDue}
              />
            </div>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              Tags
              <Input value={tagsValue} onChange={event => setTagsValue(event.target.value)} />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={onCancelEdit}>
                Abbrechen
              </Button>
              <Button type="submit" size="sm" disabled={saving || !title.trim()}>
                Speichern
              </Button>
            </div>
          </form>
        ) : (
          <>
            <div>
              <div className="flex items-start justify-between gap-2">
                <h3 className="max-w-[32ch] truncate text-sm font-semibold leading-5 text-slate-950 dark:text-slate-50" title={todo.title}>
                  {todo.title}
                </h3>
                <div className="flex shrink-0 flex-wrap justify-end gap-1">
                  {isArchivedTodo ? (
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      Archiviert
                    </span>
                  ) : null}
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-200">
                    {todo.storyPoints} SP
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      todo.priority === "urgent"
                        ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-200"
                        : todo.priority === "high"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-200"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
                    )}
                  >
                    {priorityLabels[todo.priority]}
                  </span>
                </div>
              </div>
              {todo.description ? (
                <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-slate-600 dark:text-slate-300">{todo.description}</p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className={cn("inline-flex items-center gap-1", isOverdue(todo) && "font-medium text-red-700")}>
                <CalendarDays className="size-3.5" />
                {shortDate(todo.dueAt)}
              </span>
              {todo.tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <Tags className="size-3" />
                  {tag}
                </span>
              ))}
            </div>

            <div className="rounded-md border border-slate-100 bg-slate-50/80 p-2 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="mb-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Checkliste</span>
                <span>
                  {doneSubtasks}/{todo.subtasks.length}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {todo.subtasks.length === 0 ? <p className="text-xs text-slate-400 dark:text-slate-500">Noch keine Teilschritte.</p> : null}
                {todo.subtasks.map(subtask => (
                  <label key={subtask.id} className="flex items-center justify-between gap-2 text-sm text-slate-700 dark:text-slate-200">
                    <span className="flex min-w-0 items-center gap-2">
                      <input
                        type="checkbox"
                        checked={subtask.done}
                        onChange={event => onPatchSubtask(subtask.id, event.target.checked)}
                        disabled={saving || readOnly}
                      />
                      <span className={cn("truncate", subtask.done && "text-slate-400 line-through dark:text-slate-500")}>{subtask.title}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onDeleteSubtask(subtask.id)}
                      disabled={saving || readOnly}
                      className="text-slate-400 hover:text-red-600 disabled:opacity-50 dark:text-slate-500 dark:hover:text-red-300"
                      aria-label="Teilschritt löschen"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </label>
                ))}
              </div>
              {!readOnly ? (
                <form onSubmit={submitSubtask} className="mt-2 flex gap-2">
                  <Input
                    value={subtaskTitle}
                    onChange={event => setSubtaskTitle(event.target.value)}
                    placeholder="Teilschritt"
                    className="h-8"
                  />
                  <Button type="submit" size="icon-sm" variant="outline" disabled={saving || !subtaskTitle.trim()}>
                    <Plus />
                  </Button>
                </form>
              ) : null}
            </div>

            <div className="rounded-md border border-slate-100 bg-white p-2 dark:border-slate-800 dark:bg-slate-950/30">
              <div className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">Aktivität</div>
              <div className="activity-scroll flex max-h-[3.75rem] flex-col gap-1 overflow-y-scroll pr-2">
                {todo.activity.length === 0 ? <p className="text-xs text-slate-400 dark:text-slate-500">Noch keine Einträge.</p> : null}
                {todo.activity.map(item => (
                  <p key={item.id} className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-medium text-slate-700 dark:text-slate-200">{actionLabels[item.action] ?? item.action}</span>
                    {item.detail ? `: ${item.detail}` : ""}
                  </p>
                ))}
              </div>
              {!readOnly ? (
                <form onSubmit={submitNote} className="mt-2 flex gap-2">
                  <Input value={note} onChange={event => setNote(event.target.value)} placeholder="Notiz" className="h-8" />
                  <Button type="submit" size="icon-sm" variant="outline" disabled={saving || !note.trim()}>
                    <Plus />
                  </Button>
                </form>
              ) : null}
            </div>
          </>
        )}

        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1">
            {!readOnly ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onMove(-1)}
                  disabled={saving || todo.status === "new"}
                  aria-label="Nach links verschieben"
                  title="Nach links verschieben"
                >
                  <ChevronLeft />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onMove(1)}
                  disabled={saving || todo.status === "done"}
                  aria-label="Nach rechts verschieben"
                  title="Nach rechts verschieben"
                >
                  <ChevronRight />
                </Button>
              </>
            ) : null}
          </div>
          <div className="flex gap-1">
            {!readOnly && targetLists.length > 0 ? (
              <div className="flex items-center gap-1">
                <Label htmlFor={`todo-${todo.id}-move-list`} className="sr-only">
                  In Liste verschieben
                </Label>
                <select
                  id={`todo-${todo.id}-move-list`}
                  value={moveTargetListId}
                  onChange={event => {
                    const targetId = Number(event.target.value);
                    setMoveTargetListId(event.target.value);

                    if (targetId) {
                      onMoveToList(targetId);
                      setMoveTargetListId("");
                    }
                  }}
                  disabled={saving}
                  className="h-8 max-w-32 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 shadow-xs outline-none focus-visible:border-slate-950 focus-visible:ring-2 focus-visible:ring-slate-950/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  title="In Liste verschieben"
                >
                  <option value="">Verschieben</option>
                  {targetLists.map(list => (
                    <option key={list.id} value={list.id}>
                      {list.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {!readOnly ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={onEdit}
                disabled={saving || editing}
                aria-label="ToDo bearbeiten"
                title="ToDo bearbeiten"
              >
                <Edit3 />
              </Button>
            ) : null}
            {!listReadOnly && isArchivedTodo ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => onArchive(false)}
                disabled={saving}
                aria-label="ToDo wiederherstellen"
                title="ToDo wiederherstellen"
              >
                <RotateCcw />
              </Button>
            ) : null}
            {!listReadOnly && !isArchivedTodo && todo.status === "done" ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => onArchive(true)}
                disabled={saving}
                aria-label="ToDo archivieren"
                title="ToDo archivieren"
              >
                <Archive />
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
