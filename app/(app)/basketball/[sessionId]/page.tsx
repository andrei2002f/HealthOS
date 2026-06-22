import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { formatInTimeZone } from "date-fns-tz"

import { getCachedUser } from "@/lib/supabase/server"
import {
  getBasketballSession,
  type BasketballSession,
} from "@/lib/db/queries/basketball"
import {
  BasketballForm,
  type BasketballFormInitial,
} from "@/components/basketball/BasketballForm"

const TZ = "Europe/Bucharest"

function num(value: number | null): string {
  return value !== null ? String(value) : ""
}

function toInitial(session: BasketballSession): BasketballFormInitial {
  return {
    playedAt: formatInTimeZone(session.playedAt, TZ, "yyyy-MM-dd"),
    sessionType: session.sessionType ?? "",
    location: session.location ?? "",
    surface: session.surface ?? "",
    teamScore: num(session.teamScore),
    opponentScore: num(session.opponentScore),
    points: num(session.points),
    assists: num(session.assists),
    rebounds: num(session.rebounds),
    steals: num(session.steals),
    blocks: num(session.blocks),
    turnovers: num(session.turnovers),
    minutesPlayed: num(session.minutesPlayed),
    effortRating: session.effortRating ?? 5,
    notes: session.notes ?? "",
  }
}

type Props = {
  params: Promise<{ sessionId: string }>
}

export default async function BasketballSessionPage({ params }: Props) {
  const user = await getCachedUser()
  if (!user) redirect("/login")

  const { sessionId } = await params
  const session = await getBasketballSession(user.id, sessionId)
  if (!session) notFound()

  return (
    <div className="mx-auto max-w-lg">
      <Link
        href="/basketball"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Basketball
      </Link>
      <h1 className="mb-4 mt-2 text-xl font-semibold">Edit session</h1>
      <BasketballForm
        mode="edit"
        sessionId={session.id}
        whoopLinked={Boolean(session.whoopWorkoutId)}
        initial={toInitial(session)}
      />
    </div>
  )
}
