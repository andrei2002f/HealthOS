import type { TodoPriority } from "@/lib/todos/sort";

/** Solid dot colour, used as a compact priority indicator. */
const DOT: Record<TodoPriority, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-slate-400",
};

/** Left accent border colour on a task row. */
const BORDER: Record<TodoPriority, string> = {
  high: "border-l-red-500",
  medium: "border-l-amber-500",
  low: "border-l-slate-400",
};

/** Tinted badge (text + background) for the priority label. */
const BADGE: Record<TodoPriority, string> = {
  high: "bg-red-500/10 text-red-600 dark:text-red-400",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  low: "bg-slate-400/10 text-slate-500 dark:text-slate-400",
};

const LABEL: Record<TodoPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

function asPriority(priority: string): TodoPriority {
  return priority === "high" || priority === "low" ? priority : "medium";
}

export function priorityDot(priority: string): string {
  return DOT[asPriority(priority)];
}

export function priorityBorder(priority: string): string {
  return BORDER[asPriority(priority)];
}

export function priorityBadge(priority: string): string {
  return BADGE[asPriority(priority)];
}

export function priorityLabel(priority: string): string {
  return LABEL[asPriority(priority)];
}
