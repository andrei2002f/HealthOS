import Link from "next/link"
import { notFound, redirect } from "next/navigation"

import { getCachedUser } from "@/lib/supabase/server"
import { getSupplement } from "@/lib/db/queries/supplements"
import { SupplementForm } from "@/components/supplements/SupplementForm"
import { ScheduleEditor } from "@/components/supplements/ScheduleEditor"
import { ArchiveButton } from "@/components/supplements/ArchiveButton"

type Props = {
  params: Promise<{ supplementId: string }>
}

export default async function SupplementDetailPage({ params }: Props) {
  const user = await getCachedUser()
  if (!user) redirect("/login")

  const { supplementId } = await params
  const result = await getSupplement(user.id, supplementId)
  if (!result) notFound()

  const { supplement, schedules } = result

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div>
        <Link
          href="/supplements"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Supplements
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Edit supplement</h1>
      </div>

      <SupplementForm
        mode="edit"
        supplementId={supplement.id}
        initial={{
          name: supplement.name,
          defaultDose: supplement.defaultDose ?? "",
          doseUnit: supplement.doseUnit ?? "",
          category: supplement.category ?? "",
          costPerServingRon: supplement.costPerServingRon ?? "",
          notes: supplement.notes ?? "",
        }}
      />

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">Schedule</h2>
        <ScheduleEditor supplementId={supplement.id} schedules={schedules} />
      </section>

      <section className="border-t pt-4">
        <ArchiveButton supplementId={supplement.id} />
      </section>
    </div>
  )
}
