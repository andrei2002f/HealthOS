import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { formatInTimeZone } from "date-fns-tz"

import { createClient } from "@/lib/supabase/server"
import {
  getExercise,
  getExerciseHistory,
  getExerciseAllTimePR,
} from "@/lib/db/queries/strength"
import { E1rmChart } from "@/components/strength/E1rmChart"
import { Badge } from "@/components/ui/badge"

const TZ = "Europe/Bucharest"

type Props = {
  params: Promise<{ exerciseId: string }>
}

export default async function ExerciseDetailPage({ params }: Props) {
  const { exerciseId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [exercise, history, pr] = await Promise.all([
    getExercise(user.id, exerciseId),
    getExerciseHistory(user.id, exerciseId),
    getExerciseAllTimePR(user.id, exerciseId),
  ])

  if (!exercise) notFound()

  const last10 = [...history].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10)

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-4">
        <Link href="/strength" className="text-sm text-muted-foreground hover:underline">
          ← Strength
        </Link>
      </div>

      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{exercise.name}</h1>
          <div className="mt-1 flex gap-2">
            {exercise.primaryMuscle && (
              <Badge variant="secondary" className="capitalize">
                {exercise.primaryMuscle}
              </Badge>
            )}
            {exercise.equipment && (
              <Badge variant="outline" className="capitalize">
                {exercise.equipment}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* PR card */}
      {pr ? (
        <div className="mb-4 rounded-xl border bg-muted/50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            All-time best e1RM
          </p>
          <p className="mt-1 text-2xl font-bold">{pr.e1rm.toFixed(1)} kg</p>
          <p className="text-sm text-muted-foreground">
            {pr.weightKg.toFixed(1)} kg × {pr.reps}{" "}
            {pr.reps === 1 ? "rep" : "reps"} ·{" "}
            {formatInTimeZone(pr.achievedAt, TZ, "d MMM yyyy")}
          </p>
        </div>
      ) : (
        <div className="mb-4 rounded-xl border bg-muted/50 p-4 text-sm text-muted-foreground">
          No PR yet — log a session to start tracking!
        </div>
      )}

      {/* e1RM chart */}
      <div className="mb-4 rounded-xl border p-4">
        <p className="mb-3 text-sm font-medium">e1RM (last 90 days)</p>
        <E1rmChart data={history} prE1rm={pr?.e1rm ?? 0} />
      </div>

      {/* Last 10 sessions table */}
      {last10.length > 0 && (
        <div className="rounded-xl border">
          <div className="border-b px-4 py-2 text-sm font-medium">
            Last sessions
          </div>
          <div className="divide-y">
            {last10.map((point) => (
              <Link
                key={point.sessionId}
                href={`/strength/${point.sessionId}`}
                className="flex items-center justify-between px-4 py-3 text-sm hover:bg-accent"
              >
                <span className="text-muted-foreground">{point.date}</span>
                <span className="font-medium">
                  {point.weightKg} kg × {point.reps}
                </span>
                <span className="text-muted-foreground">
                  e1RM {point.e1rm.toFixed(1)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
