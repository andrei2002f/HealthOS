import Link from "next/link"
import { formatInTimeZone } from "date-fns-tz"

import { Badge } from "@/components/ui/badge"
import type { SessionSummary } from "@/lib/db/queries/strength"

const TZ = "Europe/Bucharest"

type Props = {
  session: SessionSummary
}

export function SessionCard({ session }: Props) {
  const dateLabel = formatInTimeZone(session.performedAt, TZ, "d MMM yyyy")

  return (
    <Link
      href={`/strength/${session.id}`}
      className="block rounded-xl border p-4 transition-colors hover:bg-accent"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold">{dateLabel}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {session.exerciseCount}{" "}
            {session.exerciseCount === 1 ? "exercise" : "exercises"} ·{" "}
            {session.setCount} {session.setCount === 1 ? "set" : "sets"}
          </p>
        </div>
        {session.whoopWorkoutId && (
          <Badge variant="secondary" className="text-xs">
            Whoop
          </Badge>
        )}
      </div>
      {session.notes && (
        <p className="mt-2 line-clamp-1 text-sm text-muted-foreground">
          {session.notes}
        </p>
      )}
    </Link>
  )
}
