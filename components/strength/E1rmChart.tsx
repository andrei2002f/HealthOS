"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
} from "recharts"
import type { E1rmDataPoint } from "@/lib/db/queries/strength"

type Props = {
  data: E1rmDataPoint[]
  prE1rm: number
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: E1rmDataPoint }>
}) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-sm shadow">
      <p className="font-semibold">{d.date}</p>
      <p>e1RM: {d.e1rm.toFixed(1)} kg</p>
      <p className="text-muted-foreground">
        {d.weightKg} kg × {d.reps} reps
      </p>
    </div>
  )
}

export function E1rmChart({ data, prE1rm }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No data yet
      </div>
    )
  }

  // First occurrence is fine — PR is unique per exercise per record_type
  const prPoint = data.find((d) => d.e1rm === prE1rm)

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11 }}
          tickFormatter={(v: string) => v.slice(5)} // v is "YYYY-MM-DD" → shows "MM-DD"
        />
        <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="e1rm"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
        {prPoint && (
          <ReferenceDot
            x={prPoint.date}
            y={prPoint.e1rm}
            r={6}
            fill="hsl(var(--destructive))"
            stroke="none"
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  )
}
