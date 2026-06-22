import Link from "next/link"
import { redirect } from "next/navigation"

import { getCachedUser } from "@/lib/supabase/server"
import {
  getExperiments,
  getActiveSupplements,
  getDailyHealthMetrics,
  todayLocal,
} from "@/lib/db/queries/supplements"
import {
  partitionDays,
  compareExperiment,
} from "@/lib/supplements/experiment-analysis"
import { ExperimentForm } from "@/components/supplements/ExperimentForm"
import { ExperimentComparison } from "@/components/supplements/ExperimentComparison"

export default async function ExperimentsPage() {
  const user = await getCachedUser()
  if (!user) redirect("/login")

  const today = todayLocal()
  const [experiments, supplements, healthDays] = await Promise.all([
    getExperiments(user.id),
    getActiveSupplements(user.id),
    getDailyHealthMetrics(user.id),
  ])

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div>
        <Link
          href="/supplements"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Supplements
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Experiments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Compare your Whoop metrics during a supplement window against the
          rest of your data.
        </p>
      </div>

      {supplements.length > 0 ? (
        <ExperimentForm
          supplements={supplements.map((s) => ({ id: s.id, name: s.name }))}
          defaultDate={today}
        />
      ) : (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          Add a supplement first to start an experiment.
        </p>
      )}

      {experiments.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No experiments yet.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {experiments.map(({ experiment, supplementName }) => {
            const startDate = experiment.startDate ?? today
            const endDate = experiment.endDate ?? today
            const { inside, outside } = partitionDays(
              healthDays,
              startDate,
              endDate,
            )
            const comparison = compareExperiment(inside, outside)

            return (
              <ExperimentComparison
                key={experiment.id}
                experimentId={experiment.id}
                supplementName={supplementName}
                startDate={startDate}
                endDate={experiment.endDate}
                hypothesis={experiment.hypothesis}
                conclusion={experiment.conclusion}
                comparison={comparison}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
