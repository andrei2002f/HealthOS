import Link from "next/link"
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import {
  getStrengthSessions,
  seedExercises,
} from "@/lib/db/queries/strength"
import { SessionCard } from "@/components/strength/SessionCard"
import { Button } from "@/components/ui/button"

export default async function StrengthPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Seed exercises on first visit (idempotent)
  await seedExercises(user.id)

  const sessions = await getStrengthSessions(user.id, 20, 0)

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Strength</h1>
        <Button asChild size="sm">
          <Link href="/strength/new">+ New session</Link>
        </Button>
      </div>

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
          <p>No sessions yet.</p>
          <Button asChild variant="outline">
            <Link href="/strength/new">Log your first session</Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sessions.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  )
}
