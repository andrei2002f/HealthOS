"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { finishExperiment } from "@/app/(app)/supplements/actions"
import type { ExperimentComparison as Comparison } from "@/lib/supplements/experiment-analysis"

type Props = {
  experimentId: string
  supplementName: string
  startDate: string
  endDate: string | null
  hypothesis: string | null
  conclusion: string | null
  comparison: Comparison
}

const METRICS: Array<{
  key: keyof Pick<Comparison, "recovery" | "hrv" | "sleepPerformance">
  label: string
  unit: string
}> = [
  { key: "recovery", label: "Recovery", unit: "" },
  { key: "hrv", label: "HRV", unit: " ms" },
  { key: "sleepPerformance", label: "Sleep", unit: "%" },
]

function fmt(value: number | null, unit: string): string {
  if (value === null) return "—"
  return `${value.toFixed(1)}${unit}`
}

function MetricChart({
  inside,
  outside,
}: {
  inside: number | null
  outside: number | null
}) {
  if (inside === null || outside === null) {
    return (
      <div className="flex h-20 items-center justify-center text-xs text-muted-foreground">
        Not enough data
      </div>
    )
  }
  const data = [
    { name: "During", value: inside },
    { name: "Outside", value: outside },
  ]
  return (
    <ResponsiveContainer width="100%" height={80}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
        <Bar dataKey="value" radius={[3, 3, 0, 0]}>
          <Cell fill="hsl(var(--primary))" />
          <Cell fill="hsl(var(--muted-foreground))" />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function ExperimentComparison({
  experimentId,
  supplementName,
  startDate,
  endDate,
  hypothesis,
  conclusion,
  comparison,
}: Props) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [conclusionText, setConclusionText] = useState(conclusion ?? "")
  const [endDateText, setEndDateText] = useState(endDate ?? "")

  async function save() {
    setPending(true)
    const result = await finishExperiment({
      experimentId,
      endDate: endDateText || null,
      conclusion: conclusionText.trim() || undefined,
    })
    setPending(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Experiment updated")
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border p-4">
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold">{supplementName}</p>
          <span className="text-xs text-muted-foreground">
            {startDate} → {endDate ?? "ongoing"}
          </span>
        </div>
        {hypothesis && (
          <p className="mt-1 text-sm text-muted-foreground">{hypothesis}</p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {METRICS.map((m) => {
          const c = comparison[m.key]
          return (
            <div key={m.key} className="flex flex-col gap-1">
              <p className="text-xs font-medium">{m.label}</p>
              <MetricChart inside={c.inside} outside={c.outside} />
              <p className="text-xs text-muted-foreground">
                {fmt(c.inside, m.unit)} vs {fmt(c.outside, m.unit)}
              </p>
              {c.delta !== null && (
                <p
                  className={
                    c.delta >= 0
                      ? "text-xs font-medium text-green-600"
                      : "text-xs font-medium text-red-600"
                  }
                >
                  {c.delta >= 0 ? "+" : ""}
                  {c.delta.toFixed(1)}
                  {m.unit}
                </p>
              )}
            </div>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {comparison.insideDayCount} days during · {comparison.outsideDayCount}{" "}
        days outside
      </p>

      <div className="flex flex-col gap-2 border-t pt-3">
        <div className="flex flex-col gap-1">
          <label
            htmlFor={`end-${experimentId}`}
            className="text-xs text-muted-foreground"
          >
            End date (leave empty while ongoing)
          </label>
          <input
            id={`end-${experimentId}`}
            type="date"
            value={endDateText}
            onChange={(e) => setEndDateText(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <textarea
          rows={2}
          value={conclusionText}
          onChange={(e) => setConclusionText(e.target.value)}
          placeholder="Conclusion…"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Button size="sm" disabled={pending} onClick={save} className="w-fit">
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  )
}
