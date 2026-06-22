import Link from "next/link"
import { redirect } from "next/navigation"
import { formatInTimeZone } from "date-fns-tz"

import { getCachedUser } from "@/lib/supabase/server"
import {
  BasketballForm,
  type BasketballFormInitial,
} from "@/components/basketball/BasketballForm"

const TZ = "Europe/Bucharest"

function emptyInitial(date: string): BasketballFormInitial {
  return {
    playedAt: date,
    sessionType: "",
    location: "",
    surface: "",
    teamScore: "",
    opponentScore: "",
    points: "",
    assists: "",
    rebounds: "",
    steals: "",
    blocks: "",
    turnovers: "",
    minutesPlayed: "",
    effortRating: 5,
    notes: "",
  }
}

type Props = {
  searchParams: Promise<{ date?: string }>
}

export default async function NewBasketballPage({ searchParams }: Props) {
  const user = await getCachedUser()
  if (!user) redirect("/login")

  const { date } = await searchParams
  const today = formatInTimeZone(new Date(), TZ, "yyyy-MM-dd")

  return (
    <div className="mx-auto max-w-lg">
      <Link
        href="/basketball"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Basketball
      </Link>
      <h1 className="mb-1 mt-2 text-xl font-semibold">New session</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        For games without a Whoop workout. Whoop basketball workouts are added
        automatically.
      </p>
      <BasketballForm mode="create" initial={emptyInitial(date ?? today)} />
    </div>
  )
}
