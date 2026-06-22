"use client";

import { useState } from "react";
import { Check, Pencil, Trash2 } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { parseISO } from "date-fns";

import { cn } from "@/lib/utils";
import { isOverdue } from "@/lib/todos/sort";
import { toggleTodoAction, deleteTodoAction } from "@/app/(app)/todos/actions";
import type { Todo } from "@/lib/db/queries/todos";
import { EditTodoForm } from "@/components/todos/EditTodoForm";
import {
  priorityBadge,
  priorityBorder,
  priorityLabel,
} from "@/components/todos/priority";

const TZ = "Europe/Bucharest";

export function TodoItem({ todo, today }: { todo: Todo; today: string }) {
  const [editing, setEditing] = useState(false);
  const done = todo.completedAt !== null;
  const overdue = isOverdue(todo, today);
  const dueLabel = todo.dueDate
    ? formatInTimeZone(parseISO(todo.dueDate), TZ, "d MMM")
    : null;

  if (editing) {
    return (
      <li>
        <EditTodoForm todo={todo} onDone={() => setEditing(false)} />
      </li>
    );
  }

  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-lg border border-l-4 px-3 py-2",
        done ? "border-l-transparent" : priorityBorder(todo.priority),
      )}
    >
      {/* Toggle */}
      <form action={toggleTodoAction}>
        <input type="hidden" name="id" value={todo.id} />
        <input type="hidden" name="completed" value={done ? "false" : "true"} />
        <button
          type="submit"
          aria-label={done ? "Mark as not done" : "Mark as done"}
          className={cn(
            "flex size-5 items-center justify-center rounded-full border transition-colors",
            done
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-muted-foreground/40 hover:border-foreground",
          )}
        >
          {done && <Check className="size-3.5" />}
        </button>
      </form>

      {/* Title + due */}
      <div className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            "truncate text-sm",
            done && "text-muted-foreground line-through",
          )}
        >
          {todo.title}
        </span>
        {dueLabel && !done && (
          <span
            className={cn(
              "text-xs",
              overdue ? "font-medium text-red-500" : "text-muted-foreground",
            )}
          >
            {overdue ? "Overdue · " : "Due "}
            {dueLabel}
          </span>
        )}
      </div>

      {/* Priority badge */}
      {!done && (
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
            priorityBadge(todo.priority),
          )}
        >
          {priorityLabel(todo.priority)}
        </span>
      )}

      {/* Edit */}
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label="Edit task"
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        <Pencil className="size-4" />
      </button>

      {/* Delete */}
      <form action={deleteTodoAction}>
        <input type="hidden" name="id" value={todo.id} />
        <button
          type="submit"
          aria-label="Delete task"
          className="text-muted-foreground transition-colors hover:text-red-500"
        >
          <Trash2 className="size-4" />
        </button>
      </form>
    </li>
  );
}
