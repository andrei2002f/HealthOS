import Link from "next/link"
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import {
  getStrengthSessions,
  seedExercises,
  getUnlinkedWhoopWeightliftingWorkouts,
} from "@/lib/db/queries/strength"
import { SessionCard } from "@/components/strength/SessionCard"
import { WhoopWorkoutCard } from "@/components/strength/WhoopWorkoutCard"
import { Button } from "@/components/ui/button"

export default async function StrengthPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Seed exercises on first visit (idempotent)
  await seedExercises(user.id)

  const [sessions, whoopWorkouts] = await Promise.all([
    getStrengthSessions(user.id, 20, 0),
    getUnlinkedWhoopWeightliftingWorkouts(user.id, 20),
  ])

  // Merge and sort by date desc
  type ListItem =
    | { kind: "session"; date: Date; session: (typeof sessions)[0] }
    | { kind: "whoop"; date: Date; workout: (typeof whoopWorkouts)[0] }

  const items: ListItem[] = [
    ...sessions.map((s) => ({ kind: "session" as const, date: s.performedAt, session: s })),
    ...whoopWorkouts.map((w) => ({ kind: "whoop" as const, date: w.startAt, workout: w })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime())

  const isEmpty = items.length === 0

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Strength</h1>
        <Button asChild size="sm">
          <Link href="/strength/new">+ New session</Link>
        </Button>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
          <p>No sessions yet.</p>
          <Button asChild variant="outline">
            <Link href="/strength/new">Log your first session</Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) =>
            item.kind === "session" ? (
              <SessionCard key={item.session.id} session={item.session} />
            ) : (
              <WhoopWorkoutCard key={item.workout.id} workout={item.workout} />
            ),
          )}
        </div>
      )}
    </div>
  )
}
