import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { todos } from "@/lib/db/schema";
import { sortTodos } from "@/lib/todos/sort";

export type Todo = typeof todos.$inferSelect;
export type TodoPriority = "low" | "medium" | "high";

export type CreateTodoInput = {
  title: string;
  dueDate: string | null; // 'YYYY-MM-DD'
  priority: TodoPriority;
};

/** All todos for a user, ordered for display (active first, completed last). */
export async function listTodos(userId: string): Promise<Todo[]> {
  const rows = await db.select().from(todos).where(eq(todos.userId, userId));
  return sortTodos(rows);
}

export async function createTodo(
  userId: string,
  input: CreateTodoInput,
): Promise<Todo> {
  const [row] = await db
    .insert(todos)
    .values({
      userId,
      title: input.title,
      dueDate: input.dueDate,
      priority: input.priority,
    })
    .returning();
  return row;
}

export async function setTodoCompleted(
  userId: string,
  id: string,
  completed: boolean,
): Promise<void> {
  await db
    .update(todos)
    .set({ completedAt: completed ? new Date() : null })
    .where(and(eq(todos.id, id), eq(todos.userId, userId)));
}

export async function deleteTodo(userId: string, id: string): Promise<void> {
  await db.delete(todos).where(and(eq(todos.id, id), eq(todos.userId, userId)));
}
