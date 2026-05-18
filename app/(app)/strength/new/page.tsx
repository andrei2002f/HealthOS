import { formatInTimeZone } from "date-fns-tz"
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { getExercises, seedExercises } from "@/lib/db/queries/strength"
import { SessionBuilder } from "@/components/strength/SessionBuilder"

const TZ = "Europe/Bucharest"

type Props = {
  searchParams: Promise<{ whoopId?: string; date?: string }>
}

export default async function NewSessionPage({ searchParams }: Props) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Auto-seed exercises on first use
  await seedExercises(user.id)

  const exercises = await getExercises(user.id)

  const { whoopId, date: dateParam } = await searchParams

  const today = formatInTimeZone(new Date(), TZ, "yyyy-MM-dd")
  const isValidDate = dateParam !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
  const defaultDate = isValidDate ? dateParam : today

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 text-xl font-semibold">New session</h1>
      <SessionBuilder
        initialExercises={exercises}
        defaultDate={defaultDate}
        whoopWorkoutId={whoopId}
      />
    </div>
  )
}
