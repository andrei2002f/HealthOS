import Link from "next/link"
import { redirect } from "next/navigation"
import { FlaskConical } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import {
  getTodayIntakeStatus,
  getAdherenceGrid,
  todayLocal,
} from "@/lib/db/queries/supplements"
import { IntakeRow } from "@/components/supplements/IntakeRow"
import { AdherenceGrid } from "@/components/supplements/AdherenceGrid"
import { Button } from "@/components/ui/button"

export default async function SupplementsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const today = todayLocal()
  const [items, adherence] = await Promise.all([
    getTodayIntakeStatus(user.id, today),
    getAdherenceGrid(user.id, 7),
  ])

  const isEmpty = items.length === 0

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Supplements</h1>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/supplements/experiments">
              <FlaskConical className="size-4" /> Experiments
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/supplements/new">+ Add</Link>
          </Button>
        </div>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
          <p>No supplements yet.</p>
          <Button asChild variant="outline">
            <Link href="/supplements/new">Add your first supplement</Link>
          </Button>
        </div>
      ) : (
        <>
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">
              Today
            </h2>
            {items.map((item) => (
              <IntakeRow key={item.supplement.id} item={item} />
            ))}
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">
              Last 7 days
            </h2>
            <AdherenceGrid dates={adherence.dates} rows={adherence.rows} />
          </section>
        </>
      )}
    </div>
  )
}
