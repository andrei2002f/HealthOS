import Link from "next/link"
import { formatInTimeZone } from "date-fns-tz"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { BasketballSession } from "@/lib/db/queries/basketball"

const TZ = "Europe/Bucharest"

type Props = {
  session: BasketballSession
}

function result(team: number | null, opp: number | null) {
  if (team === null || opp === null) return null
  if (team > opp) return { label: "W", className: "bg-green-500 text-white" }
  if (team < opp) return { label: "L", className: "bg-red-500 text-white" }
  return { label: "D", className: "bg-muted text-foreground" }
}

export function SessionCard({ session }: Props) {
  const dateLabel = formatInTimeZone(session.playedAt, TZ, "d MMM yyyy")
  const res = result(session.teamScore, session.opponentScore)

  const meta = [
    session.points !== null ? `${session.points} pts` : null,
    session.sessionType,
    session.location,
    session.minutesPlayed !== null ? `${session.minutesPlayed} min` : null,
  ].filter((v): v is string => Boolean(v))

  const needsDetails =
    session.teamScore === null &&
    session.points === null &&
    !session.notes

  return (
    <Link
      href={`/basketball/${session.id}`}
      className="block rounded-xl border p-4 transition-colors hover:bg-accent"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{dateLabel}</p>
          {meta.length > 0 && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {meta.join(" · ")}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {res && (
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full text-xs font-bold",
                res.className,
              )}
            >
              {res.label}
            </span>
          )}
          {session.teamScore !== null && session.opponentScore !== null && (
            <span className="text-sm font-medium tabular-nums">
              {session.teamScore}–{session.opponentScore}
            </span>
          )}
          {session.whoopWorkoutId && (
            <Badge variant="secondary" className="text-xs">
              Whoop
            </Badge>
          )}
        </div>
      </div>
      {session.notes && (
        <p className="mt-2 line-clamp-1 text-sm text-muted-foreground">
          {session.notes}
        </p>
      )}
      {needsDetails && (
        <p className="mt-1 text-xs text-muted-foreground">
          Tap to add score and stats →
        </p>
      )}
    </Link>
  )
}
