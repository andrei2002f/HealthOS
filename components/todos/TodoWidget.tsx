import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { parseISO } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { listTodos, type Todo } from "@/lib/db/queries/todos";
import { isOverdue, todayKey } from "@/lib/todos/sort";
import { priorityDot } from "@/components/todos/priority";

const TZ = "Europe/Bucharest";
const MAX_SHOWN = 5;

export async function TodoWidget({ userId }: { userId: string }) {
  const todos = await listTodos(userId);
  const today = todayKey();
  const active = todos.filter((t) => t.completedAt === null);
  const shown = active.slice(0, MAX_SHOWN);
  const remaining = active.length - shown.length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium">
          Todos
        </CardTitle>
        <Link
          href="/todos"
          className="text-muted-foreground text-xs underline-offset-4 hover:underline"
        >
          View all →
        </Link>
      </CardHeader>
      <CardContent>
        {active.length === 0 ? (
          <p className="text-muted-foreground py-2 text-sm">
            All clear. Nothing to do.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {shown.map((t) => (
              <WidgetRow key={t.id} todo={t} today={today} />
            ))}
            {remaining > 0 && (
              <li className="text-muted-foreground pt-1 text-xs">
                +{remaining} more
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function WidgetRow({ todo, today }: { todo: Todo; today: string }) {
  const overdue = isOverdue(todo, today);
  const dueLabel = todo.dueDate
    ? formatInTimeZone(parseISO(todo.dueDate), TZ, "d MMM")
    : null;

  return (
    <li className="flex items-center gap-2 text-sm">
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          priorityDot(todo.priority),
        )}
      />
      <span className="min-w-0 truncate">{todo.title}</span>
      {dueLabel && (
        <span
          className={cn(
            "shrink-0 text-xs",
            overdue ? "font-medium text-red-500" : "text-muted-foreground",
          )}
        >
          {dueLabel}
        </span>
      )}
    </li>
  );
}
