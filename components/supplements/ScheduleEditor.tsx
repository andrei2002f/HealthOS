"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  saveScheduleAction,
  deleteScheduleAction,
} from "@/app/(app)/supplements/actions"
import type { SupplementSchedule } from "@/lib/db/queries/supplements"

const DAYS = [
  { i: 0, label: "Sun" },
  { i: 1, label: "Mon" },
  { i: 2, label: "Tue" },
  { i: 3, label: "Wed" },
  { i: 4, label: "Thu" },
  { i: 5, label: "Fri" },
  { i: 6, label: "Sat" },
] as const

type Props = {
  supplementId: string
  schedules: SupplementSchedule[]
}

function describeDays(days: number[] | null): string {
  if (!days || days.length === 0 || days.length === 7) return "Every day"
  return DAYS.filter((d) => days.includes(d.i))
    .map((d) => d.label)
    .join(", ")
}

export function ScheduleEditor({ supplementId, schedules }: Props) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [time, setTime] = useState("")
  const [days, setDays] = useState<Set<number>>(new Set())

  const toggleDay = (i: number) =>
    setDays((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })

  async function addSlot() {
    setPending(true)
    const result = await saveScheduleAction({
      supplementId,
      timeOfDay: time || null,
      daysOfWeek: [...days],
    })
    setPending(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setTime("")
    setDays(new Set())
    router.refresh()
  }

  async function removeSlot(scheduleId: string) {
    setPending(true)
    const result = await deleteScheduleAction(scheduleId, supplementId)
    setPending(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      {schedules.length > 0 && (
        <ul className="flex flex-col gap-2">
          {schedules.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
            >
              <span>
                <span className="font-medium">
                  {s.timeOfDay ? s.timeOfDay.slice(0, 5) : "Any time"}
                </span>
                <span className="ml-2 text-muted-foreground">
                  {describeDays(s.daysOfWeek)}
                </span>
              </span>
              <Button
                size="icon-sm"
                variant="ghost"
                disabled={pending}
                onClick={() => removeSlot(s.id)}
                aria-label="Delete schedule"
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-3 rounded-lg border border-dashed p-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="scheduleTime" className="text-sm font-medium">
            Time
          </label>
          <input
            id="scheduleTime"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium">Days (none = every day)</p>
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((d) => {
              const active = days.has(d.i)
              return (
                <button
                  key={d.i}
                  type="button"
                  onClick={() => toggleDay(d.i)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    active
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-border bg-background hover:bg-muted",
                  )}
                >
                  {d.label}
                </button>
              )
            })}
          </div>
        </div>
        <Button size="sm" disabled={pending} onClick={addSlot}>
          Add schedule slot
        </Button>
      </div>
    </div>
  )
}
