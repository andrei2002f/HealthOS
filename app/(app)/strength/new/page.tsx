import { formatInTimeZone } from "date-fns-tz"
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { getExercises, seedExercises } from "@/lib/db/queries/strength"
import { SessionBuilder } from "@/components/strength/SessionBuilder"

const TZ = "Europe/Bucharest"

export default async function NewSessionPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Auto-seed exercises on first use
  await seedExercises(user.id)

  const exercises = await getExercises(user.id)
  const today = formatInTimeZone(new Date(), TZ, "yyyy-MM-dd")

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 text-xl font-semibold">New session</h1>
      <SessionBuilder initialExercises={exercises} defaultDate={today} />
    </div>
  )
}
