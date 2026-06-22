"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import {
  createTodo,
  deleteTodo,
  setTodoCompleted,
} from "@/lib/db/queries/todos";

const priorityEnum = z.enum(["low", "medium", "high"]);

const dueDateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();

const createSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(500),
  dueDate: dueDateField,
  priority: priorityEnum,
});

export type TodoActionState = { ok: true } | { ok: false; error: string };

/** Empty string from the date input becomes null. */
function normalizeDueDate(value: FormDataEntryValue | null): string | null {
  const s = typeof value === "string" ? value.trim() : "";
  return s === "" ? null : s;
}

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function revalidateTodos() {
  revalidatePath("/todos");
  revalidatePath("/");
}

export async function createTodoAction(
  _prev: TodoActionState,
  formData: FormData,
): Promise<TodoActionState> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Not authenticated." };

  const parsed = createSchema.safeParse({
    title: formData.get("title"),
    dueDate: normalizeDueDate(formData.get("dueDate")),
    priority: formData.get("priority"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  await createTodo(userId, parsed.data);
  revalidateTodos();
  return { ok: true };
}

export async function toggleTodoAction(formData: FormData): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;

  const completed = formData.get("completed") === "true";
  await setTodoCompleted(userId, id.data, completed);
  revalidateTodos();
}

export async function deleteTodoAction(formData: FormData): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;

  await deleteTodo(userId, id.data);
  revalidateTodos();
}
