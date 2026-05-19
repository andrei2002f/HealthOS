"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { startExperiment } from "@/app/(app)/supplements/actions"

type Props = {
  supplements: Array<{ id: string; name: string }>
  defaultDate: string // YYYY-MM-DD
}

export function ExperimentForm({ supplements, defaultDate }: Props) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [supplementId, setSupplementId] = useState(supplements[0]?.id ?? "")
  const [startDate, setStartDate] = useState(defaultDate)
  const [hypothesis, setHypothesis] = useState("")

  const inputClass =
    "w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!supplementId) {
      toast.error("Pick a supplement")
      return
    }
    setPending(true)
    const result = await startExperiment({
      supplementId,
      startDate,
      hypothesis: hypothesis.trim() || undefined,
    })
    setPending(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Experiment started")
    setHypothesis("")
    router.refresh()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-xl border p-4"
    >
      <p className="text-sm font-medium">Start an experiment</p>

      <div className="flex flex-col gap-1">
        <label htmlFor="expSupplement" className="text-xs text-muted-foreground">
          Supplement
        </label>
        <select
          id="expSupplement"
          value={supplementId}
          onChange={(e) => setSupplementId(e.target.value)}
          className={inputClass}
        >
          {supplements.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="expStart" className="text-xs text-muted-foreground">
          Start date
        </label>
        <input
          id="expStart"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="expHypothesis" className="text-xs text-muted-foreground">
          Hypothesis (optional)
        </label>
        <textarea
          id="expHypothesis"
          rows={2}
          value={hypothesis}
          onChange={(e) => setHypothesis(e.target.value)}
          placeholder="e.g. Magnesium improves my sleep performance"
          className={inputClass}
        />
      </div>

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Starting…" : "Start experiment"}
      </Button>
    </form>
  )
}
