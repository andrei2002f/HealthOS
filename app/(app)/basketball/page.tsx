import Link from "next/link"
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import {
  autoCreateBasketballSessions,
  getBasketballSessions,
  getBasketballStats,
} from "@/lib/db/queries/basketball"
import { SessionCard } from "@/components/basketball/SessionCard"
import { StatsSummary } from "@/components/basketball/StatsSummary"
import { Button } from "@/components/ui/button"

const PAGE_SIZE = 20

type Props = {
  searchParams: Promise<{ page?: string }>
}

export default async function BasketballPage({ searchParams }: Props) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Materialise a session for any Whoop basketball workout that lacks one.
  await autoCreateBasketballSessions(user.id)

  const { page: pageParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1)
  const offset = (page - 1) * PAGE_SIZE

  const [sessions, stats] = await Promise.all([
    getBasketballSessions(user.id, PAGE_SIZE, offset),
    getBasketballStats(user.id),
  ])

  const hasNext = sessions.length === PAGE_SIZE
  const hasPrev = page > 1
  const isEmpty = sessions.length === 0

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Basketball</h1>
        <Button asChild size="sm">
          <Link href="/basketball/new">+ New session</Link>
        </Button>
      </div>

      {stats.totalGames > 0 && (
        <div className="mb-4">
          <StatsSummary stats={stats} />
        </div>
      )}

      {isEmpty ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
          <p>No sessions yet.</p>
          <p className="text-sm">
            Whoop basketball workouts appear here automatically after a sync.
          </p>
          <Button asChild variant="outline">
            <Link href="/basketball/new">Log a game manually</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {sessions.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>

          {(hasPrev || hasNext) && (
            <div className="mt-4 flex items-center justify-between">
              {hasPrev ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/basketball?page=${page - 1}`}>← Newer</Link>
                </Button>
              ) : (
                <div />
              )}
              {hasNext && (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/basketball?page=${page + 1}`}>Older →</Link>
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
