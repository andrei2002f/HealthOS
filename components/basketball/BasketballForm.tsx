"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { saveSession, updateSession } from "@/app/(app)/basketball/actions"

const SESSION_TYPES = ["pickup", "league", "training", "3v3", "5v5"] as const
const SURFACES = [
  { value: "parquet", label: "Parquet" },
  { value: "outdoor_concrete", label: "Outdoor concrete" },
  { value: "synthetic", label: "Synthetic" },
] as const

const COUNT_FIELDS = [
  { key: "points", label: "Points" },
  { key: "assists", label: "Assists" },
  { key: "rebounds", label: "Rebounds" },
  { key: "steals", label: "Steals" },
  { key: "blocks", label: "Blocks" },
  { key: "turnovers", label: "Turnovers" },
] as const

type CountKey = (typeof COUNT_FIELDS)[number]["key"]

export type BasketballFormInitial = {
  playedAt: string // YYYY-MM-DD
  sessionType: string
  location: string
  surface: string
  teamScore: string
  opponentScore: string
  points: string
  assists: string
  rebounds: string
  steals: string
  blocks: string
  turnovers: string
  minutesPlayed: string
  effortRating: number
  notes: string
}

type Props = {
  mode: "create" | "edit"
  sessionId?: string
  whoopLinked?: boolean
  initial: BasketballFormInitial
}

function toCount(v: string): number | null {
  const trimmed = v.trim()
  if (trimmed === "") return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? Math.round(n) : null
}

export function BasketballForm({
  mode,
  sessionId,
  whoopLinked,
  initial,
}: Props) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [form, setForm] = useState<BasketballFormInitial>(initial)

  const set = (key: keyof BasketballFormInitial, value: string | number) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPending(true)

    const payload = {
      playedAt: new Date(`${form.playedAt}T12:00:00`).toISOString(),
      sessionType: form.sessionType || undefined,
      location: form.location.trim() || undefined,
      surface: form.surface || undefined,
      teamScore: toCount(form.teamScore),
      opponentScore: toCount(form.opponentScore),
      points: toCount(form.points),
      assists: toCount(form.assists),
      rebounds: toCount(form.rebounds),
      steals: toCount(form.steals),
      blocks: toCount(form.blocks),
      turnovers: toCount(form.turnovers),
      minutesPlayed: toCount(form.minutesPlayed),
      effortRating: form.effortRating,
      notes: form.notes.trim() || undefined,
    }

    const result =
      mode === "edit" && sessionId
        ? await updateSession({ ...payload, sessionId })
        : await saveSession(payload)

    setPending(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }

    toast.success(mode === "edit" ? "Session updated" : "Session saved")
    router.push(`/basketball/${result.sessionId}`)
    router.refresh()
  }

  const inputClass =
    "w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {whoopLinked && (
        <Badge variant="secondary" className="w-fit">
          Linked to a Whoop basketball workout
        </Badge>
      )}

      {/* Basics */}
      <div className="flex flex-col gap-4 rounded-xl border p-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="playedAt" className="text-sm font-medium">
            Date
          </label>
          <input
            id="playedAt"
            type="date"
            value={form.playedAt}
            onChange={(e) => set("playedAt", e.target.value)}
            required
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="sessionType" className="text-sm font-medium">
            Type
          </label>
          <select
            id="sessionType"
            value={form.sessionType}
            onChange={(e) => set("sessionType", e.target.value)}
            className={inputClass}
          >
            <option value="">—</option>
            {SESSION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="location" className="text-sm font-medium">
            Location
          </label>
          <input
            id="location"
            type="text"
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
            placeholder="e.g. Sala Sporturilor"
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="surface" className="text-sm font-medium">
            Surface
          </label>
          <select
            id="surface"
            value={form.surface}
            onChange={(e) => set("surface", e.target.value)}
            className={inputClass}
          >
            <option value="">—</option>
            {SURFACES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Score */}
      <div className="flex flex-col gap-3 rounded-xl border p-4">
        <p className="text-sm font-medium">Final score</p>
        <div className="flex items-center gap-3">
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="teamScore" className="text-xs text-muted-foreground">
              My team
            </label>
            <input
              id="teamScore"
              type="text"
              inputMode="numeric"
              value={form.teamScore}
              onChange={(e) => set("teamScore", e.target.value)}
              className={inputClass}
            />
          </div>
          <span className="pt-5 text-muted-foreground">–</span>
          <div className="flex flex-1 flex-col gap-1">
            <label
              htmlFor="opponentScore"
              className="text-xs text-muted-foreground"
            >
              Opponent
            </label>
            <input
              id="opponentScore"
              type="text"
              inputMode="numeric"
              value={form.opponentScore}
              onChange={(e) => set("opponentScore", e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Box score */}
      <div className="flex flex-col gap-3 rounded-xl border p-4">
        <p className="text-sm font-medium">Box score</p>
        <div className="grid grid-cols-3 gap-3">
          {COUNT_FIELDS.map((f) => (
            <div key={f.key} className="flex flex-col gap-1">
              <label
                htmlFor={f.key}
                className="text-xs text-muted-foreground"
              >
                {f.label}
              </label>
              <input
                id={f.key}
                type="text"
                inputMode="numeric"
                value={form[f.key as CountKey]}
                onChange={(e) => set(f.key as CountKey, e.target.value)}
                className={inputClass}
              />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="minutesPlayed"
            className="text-xs text-muted-foreground"
          >
            Minutes played
          </label>
          <input
            id="minutesPlayed"
            type="text"
            inputMode="numeric"
            value={form.minutesPlayed}
            onChange={(e) => set("minutesPlayed", e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {/* Effort */}
      <div className="flex flex-col gap-2 rounded-xl border p-4">
        <div className="flex items-center justify-between">
          <label htmlFor="effortRating" className="text-sm font-medium">
            Effort
          </label>
          <span className="min-w-[1.5rem] text-center text-sm font-bold tabular-nums">
            {form.effortRating}
          </span>
        </div>
        <input
          id="effortRating"
          type="range"
          min={1}
          max={10}
          step={1}
          value={form.effortRating}
          onChange={(e) => set("effortRating", Number(e.target.value))}
          className="h-2 w-full cursor-pointer accent-indigo-600"
        />
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>Easy</span>
          <span>Max effort</span>
        </div>
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1">
        <label htmlFor="notes" className="text-sm font-medium">
          Notes (optional)
        </label>
        <textarea
          id="notes"
          rows={3}
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="How did it go?"
          className={inputClass}
        />
      </div>

      <Button type="submit" disabled={pending} className="w-full">
        {pending
          ? "Saving…"
          : mode === "edit"
            ? "Update session"
            : "Save session"}
      </Button>
    </form>
  )
}
