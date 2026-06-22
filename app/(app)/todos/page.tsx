import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { listTodos } from "@/lib/db/queries/todos";
import { todayKey } from "@/lib/todos/sort";
import { AddTodoForm } from "@/components/todos/AddTodoForm";
import { TodoItem } from "@/components/todos/TodoItem";

export default async function TodosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const todos = await listTodos(user!.id);
  const today = todayKey();

  const active = todos.filter((t) => t.completedAt === null);
  const completed = todos.filter((t) => t.completedAt !== null);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground text-sm"
      >
        ← Home
      </Link>

      <h1 className="text-xl font-semibold">Todos</h1>

      <AddTodoForm />

      {todos.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">
          Nothing here yet. Add your first task above.
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {active.map((todo) => (
              <TodoItem key={todo.id} todo={todo} today={today} />
            ))}
          </ul>

          {completed.length > 0 && (
            <>
              <h2 className="text-muted-foreground mt-2 text-xs font-semibold tracking-wide uppercase">
                Completed
              </h2>
              <ul className="flex flex-col gap-2">
                {completed.map((todo) => (
                  <TodoItem key={todo.id} todo={todo} today={today} />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
