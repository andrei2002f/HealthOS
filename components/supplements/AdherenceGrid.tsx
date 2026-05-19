import { format, parseISO } from "date-fns"

import { cn } from "@/lib/utils"
import type { AdherenceRow } from "@/lib/db/queries/supplements"

type Props = {
  dates: string[]
  rows: AdherenceRow[]
}

export function AdherenceGrid({ dates, rows }: Props) {
  if (rows.length === 0) return null

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th className="p-2 text-left font-medium">Supplement</th>
            {dates.map((date) => (
              <th
                key={date}
                className="p-2 text-center text-xs font-medium text-muted-foreground"
              >
                {format(parseISO(date), "EEE")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.supplement.id} className="border-b last:border-0">
              <td className="max-w-[8rem] truncate p-2 font-medium">
                {row.supplement.name}
              </td>
              {row.cells.map((cell) => (
                <td key={cell.date} className="p-2 text-center">
                  <span
                    className={cn(
                      "mx-auto block size-4 rounded-full",
                      cell.status === "taken" && "bg-green-500",
                      cell.status === "skipped" && "bg-muted-foreground/40",
                      cell.status === "pending" &&
                        "border border-dashed border-muted-foreground/30",
                    )}
                    aria-label={cell.status}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
