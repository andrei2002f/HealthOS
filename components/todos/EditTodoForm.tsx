"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DueDatePicker } from "@/components/todos/DueDatePicker";
import {
  updateTodoAction,
  type TodoActionState,
} from "@/app/(app)/todos/actions";
import type { Todo } from "@/lib/db/queries/todos";

const initialState: TodoActionState = { ok: false, error: "" };

export function EditTodoForm({
  todo,
  onDone,
}: {
  todo: Todo;
  onDone: () => void;
}) {
  const [state, formAction, isPending] = useActionState(
    updateTodoAction,
    initialState,
  );

  useEffect(() => {
    if (state.ok) {
      toast.success("Task updated");
      onDone();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, onDone]);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-2 rounded-lg border p-3"
    >
      <input type="hidden" name="id" value={todo.id} />
      <Input
        name="title"
        defaultValue={todo.title}
        placeholder="Task…"
        required
        maxLength={500}
        aria-label="Task title"
        autoFocus
      />
      <div className="flex flex-wrap items-center gap-2">
        <DueDatePicker name="dueDate" defaultValue={todo.dueDate ?? undefined} />
        <select
          name="priority"
          defaultValue={todo.priority}
          aria-label="Priority"
          className="bg-background focus:ring-ring rounded-md border px-2 text-sm focus:ring-2 focus:outline-none"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <div className="ml-auto flex gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onDone}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </form>
  );
}
