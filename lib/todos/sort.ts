import { toZonedTime } from "date-fns-tz";

export type TodoPriority = "low" | "medium" | "high";

/** Minimal shape needed to sort a todo; matches the Drizzle row. */
export type SortableTodo = {
  dueDate: string | null; // 'YYYY-MM-DD'
  priority: string;
  completedAt: Date | string | null;
  createdAt: Date | string;
};

const APP_TIMEZONE = "Europe/Bucharest";

const PRIORITY_RANK: Record<TodoPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function priorityRank(priority: string): number {
  return PRIORITY_RANK[priority as TodoPriority] ?? PRIORITY_RANK.medium;
}

function toTime(value: Date | string): number {
  return (value instanceof Date ? value : new Date(value)).getTime();
}

/** Today's date in the app timezone as 'YYYY-MM-DD'. */
export function todayKey(now: Date = new Date()): string {
  const zoned = toZonedTime(now, APP_TIMEZONE);
  const y = zoned.getFullYear();
  const m = String(zoned.getMonth() + 1).padStart(2, "0");
  const d = String(zoned.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** A todo is overdue when it has a due date strictly before today. */
export function isOverdue(
  todo: SortableTodo,
  today: string = todayKey(),
): boolean {
  return !todo.completedAt && todo.dueDate !== null && todo.dueDate < today;
}

/**
 * Order: active before completed; within active by overdue → priority →
 * due date (nulls last) → created. Completed go last, most recently first.
 */
export function compareTodos(
  a: SortableTodo,
  b: SortableTodo,
  today: string = todayKey(),
): number {
  const aDone = a.completedAt !== null;
  const bDone = b.completedAt !== null;
  if (aDone !== bDone) return aDone ? 1 : -1;

  if (aDone && bDone) {
    // Most recently completed first.
    return toTime(b.completedAt!) - toTime(a.completedAt!);
  }

  const aOverdue = isOverdue(a, today);
  const bOverdue = isOverdue(b, today);
  if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;

  const byPriority = priorityRank(a.priority) - priorityRank(b.priority);
  if (byPriority !== 0) return byPriority;

  // Due date ascending, nulls last.
  if (a.dueDate !== b.dueDate) {
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return a.dueDate < b.dueDate ? -1 : 1;
  }

  return toTime(a.createdAt) - toTime(b.createdAt);
}

export function sortTodos<T extends SortableTodo>(
  todos: T[],
  today: string = todayKey(),
): T[] {
  return [...todos].sort((a, b) => compareTodos(a, b, today));
}
