import Link from "next/link"
import { formatInTimeZone } from "date-fns-tz"
import { Zap } from "lucide-react"

import type { UnlinkedWhoopWorkout } from "@/lib/db/queries/strength"
import { Button } from "@/components/ui/button"

const TZ = "Europe/Bucharest"

type Props = { workout: UnlinkedWhoopWorkout }

export function WhoopWorkoutCard({ workout }: Props) {
  const localDate = formatInTimeZone(workout.startAt, TZ, "yyyy-MM-dd")
  const displayDate = formatInTimeZone(workout.startAt, TZ, "d MMM yyyy")

  const durationMin =
    workout.endAt
      ? Math.round((workout.endAt.getTime() - workout.startAt.getTime()) / 60000)
      : null

  return (
    <div className="flex items-center justify-between rounded-xl border border-dashed bg-muted/30 px-4 py-3">
      <div>
        <p className="font-medium">{displayDate}</p>
        <div className="mt-0.5 flex items-center gap-3 text-sm text-muted-foreground">
          {durationMin !== null && <span>{durationMin} min</span>}
          {workout.strain !== null && (
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              {workout.strain.toFixed(1)} strain
            </span>
          )}
          <span className="text-xs">Whoop · no sets logged</span>
        </div>
      </div>
      <Button asChild size="sm" variant="outline">
        <Link href={`/strength/new?whoopId=${workout.id}&date=${localDate}`}>
          Add sets →
        </Link>
      </Button>
    </div>
  )
}
