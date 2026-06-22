"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DueDatePicker } from "@/components/todos/DueDatePicker";
import {
  createTodoAction,
  type TodoActionState,
} from "@/app/(app)/todos/actions";

const initialState: TodoActionState = { ok: false, error: "" };

export function AddTodoForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(
    createTodoAction,
    initialState,
  );

  useEffect(() => {
    if (state.ok) {
      // Clears native fields and fires a `reset` event the date picker listens for.
      formRef.current?.reset();
      toast.success("Task added");
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center"
    >
      <Input
        name="title"
        placeholder="Add a task…"
        required
        maxLength={500}
        className="flex-1"
        aria-label="Task title"
      />
      <div className="flex gap-2">
        <DueDatePicker name="dueDate" />
        <select
          name="priority"
          defaultValue="medium"
          aria-label="Priority"
          className="bg-background focus:ring-ring rounded-md border px-2 text-sm focus:ring-2 focus:outline-none"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Adding…" : "Add"}
        </Button>
      </div>
    </form>
  );
}
