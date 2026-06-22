import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { formatInTimeZone } from "date-fns-tz"

import { getCachedUser } from "@/lib/supabase/server"
import { getStrengthSession } from "@/lib/db/queries/strength"
import { PRBadge } from "@/components/strength/PRBadge"
import { Badge } from "@/components/ui/badge"

const TZ = "Europe/Bucharest"

type Props = {
  params: Promise<{ sessionId: string }>
}

export default async function SessionDetailPage({ params }: Props) {
  const { sessionId } = await params

  const user = await getCachedUser()
  if (!user) redirect("/login")

  const data = await getStrengthSession(user.id, sessionId)
  if (!data) notFound()

  const { session, entries } = data
  const dateLabel = formatInTimeZone(session.performedAt, TZ, "EEEE, d MMM yyyy")

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-4">
        <Link href="/strength" className="text-sm text-muted-foreground hover:underline">
          ← Strength
        </Link>
      </div>

      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{dateLabel}</h1>
          <p className="text-sm text-muted-foreground">
            {entries.length} {entries.length === 1 ? "exercise" : "exercises"}
          </p>
        </div>
        {session.whoopWorkoutId && (
          <Badge variant="secondary">Whoop linked</Badge>
        )}
      </div>

      {session.notes && (
        <p className="mb-4 rounded-lg bg-muted px-3 py-2 text-sm">
          {session.notes}
        </p>
      )}

      <div className="flex flex-col gap-4">
        {entries.map((entry) => (
          <div key={entry.exerciseId} className="rounded-xl border p-4">
            <Link
              href={`/strength/exercises/${entry.exerciseId}`}
              className="mb-3 block font-semibold hover:underline"
            >
              {entry.exerciseName}
            </Link>

            <div className="flex flex-col gap-1.5">
              {entry.sets.map((set, i) => (
                <div
                  key={set.id}
                  className="flex items-center gap-3 text-sm"
                >
                  <span className="w-6 text-center text-muted-foreground">
                    {set.isWarmup ? "W" : i + 1}
                  </span>
                  <span className="font-medium">
                    {set.reps} × {set.weightKg} kg
                  </span>
                  {set.rpe && (
                    <span className="text-muted-foreground">RPE {set.rpe}</span>
                  )}
                  {set.isPR && <PRBadge />}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
