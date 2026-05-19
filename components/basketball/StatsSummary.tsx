import type { BasketballStats } from "@/lib/basketball/stats"

type Props = {
  stats: BasketballStats
}

function fmt(value: number | null, digits = 1): string {
  if (value === null) return "—"
  return value.toFixed(digits)
}

export function StatsSummary({ stats }: Props) {
  const items: Array<{ label: string; value: string }> = [
    { label: "Games", value: String(stats.totalGames) },
    {
      label: "Record",
      value: `${stats.wins}–${stats.losses}`,
    },
    {
      label: "Win rate",
      value: stats.winRate === null ? "—" : `${Math.round(stats.winRate * 100)}%`,
    },
    { label: "Avg points", value: fmt(stats.avgPoints) },
    { label: "Avg assists", value: fmt(stats.avgAssists) },
    { label: "Pts / min", value: fmt(stats.pointsPerMinute, 2) },
  ]

  return (
    <div className="grid grid-cols-3 gap-3 rounded-xl border p-4">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col">
          <span className="text-lg font-bold tabular-nums">{item.value}</span>
          <span className="text-xs text-muted-foreground">{item.label}</span>
        </div>
      ))}
    </div>
  )
}
