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

const PAGE_SIZE = 20

type Props = {
  searchParams: Promise<{ page?: string }>
}

export default async function StrengthPage({ searchParams }: Props) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  await seedExercises(user.id)

  const { page: pageParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1)
  const offset = (page - 1) * PAGE_SIZE
  const isFirstPage = page === 1

  const [sessions, whoopWorkouts] = await Promise.all([
    getStrengthSessions(user.id, PAGE_SIZE, offset),
    isFirstPage ? getUnlinkedWhoopWeightliftingWorkouts(user.id, 20) : Promise.resolve([]),
  ])

  const hasNext = sessions.length === PAGE_SIZE
  const hasPrev = page > 1

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
        <>
          <div className="flex flex-col gap-3">
            {items.map((item) =>
              item.kind === "session" ? (
                <SessionCard key={item.session.id} session={item.session} />
              ) : (
                <WhoopWorkoutCard key={item.workout.id} workout={item.workout} />
              ),
            )}
          </div>

          {(hasPrev || hasNext) && (
            <div className="mt-4 flex items-center justify-between">
              {hasPrev ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/strength?page=${page - 1}`}>← Newer</Link>
                </Button>
              ) : (
                <div />
              )}
              {hasNext && (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/strength?page=${page + 1}`}>Older →</Link>
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
