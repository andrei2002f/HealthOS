"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, Dumbbell } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SetRow } from "./SetRow"
import { ExerciseSearchSheet } from "./ExerciseSearchSheet"
import { saveSession } from "@/app/(app)/strength/actions"
import type { Exercise } from "@/lib/db/queries/strength"

// ──────────── types ────────────

type DraftSet = {
  id: string
  reps: number
  weightKg: number
  rpe: number | null
  isWarmup: boolean
}

type DraftEntry = {
  id: string
  exercise: Exercise
  sets: DraftSet[]
}

function makeSet(overrides?: Partial<DraftSet>): DraftSet {
  return {
    id: crypto.randomUUID(),
    reps: 5,
    weightKg: 60,
    rpe: null,
    isWarmup: false,
    ...overrides,
  }
}

// ──────────── component ────────────

type Props = {
  initialExercises: Exercise[]
  defaultDate: string // "YYYY-MM-DD"
}

export function SessionBuilder({ initialExercises, defaultDate }: Props) {
  const router = useRouter()
  const [exercises, setExercises] = useState<Exercise[]>(initialExercises)
  const [entries, setEntries] = useState<DraftEntry[]>([])
  const [date, setDate] = useState(defaultDate)
  const [notes, setNotes] = useState("")
  const [sheetOpen, setSheetOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ── entry mutations ──

  function addEntry(exercise: Exercise) {
    setEntries((prev) => [
      ...prev,
      { id: crypto.randomUUID(), exercise, sets: [makeSet()] },
    ])
  }

  function removeEntry(entryId: string) {
    setEntries((prev) => prev.filter((e) => e.id !== entryId))
  }

  function addSet(entryId: string, cloneLast: boolean) {
    setEntries((prev) =>
      prev.map((entry) => {
        if (entry.id !== entryId) return entry
        const lastSet = entry.sets.at(-1)
        const newSet = cloneLast && lastSet
          ? makeSet({ reps: lastSet.reps, weightKg: lastSet.weightKg })
          : makeSet()
        return { ...entry, sets: [...entry.sets, newSet] }
      }),
    )
  }

  function removeSet(entryId: string, setId: string) {
    setEntries((prev) =>
      prev.map((entry) => {
        if (entry.id !== entryId) return entry
        return { ...entry, sets: entry.sets.filter((s) => s.id !== setId) }
      }),
    )
  }

  function updateSet(entryId: string, setId: string, changes: Partial<DraftSet>) {
    setEntries((prev) =>
      prev.map((entry) => {
        if (entry.id !== entryId) return entry
        return {
          ...entry,
          sets: entry.sets.map((s) =>
            s.id === setId ? { ...s, ...changes } : s,
          ),
        }
      }),
    )
  }

  // ── submit ──

  async function handleSubmit() {
    if (entries.length === 0) {
      toast.error("Add at least one exercise")
      return
    }

    setIsSubmitting(true)

    const payload = {
      // Use noon of the selected date so timezone shifts never change the day
      performedAt: new Date(`${date}T12:00:00`).toISOString(),
      notes: notes.trim() || undefined,
      entries: entries.map((entry) => ({
        exerciseId: entry.exercise.id,
        exerciseName: entry.exercise.name,
        sets: entry.sets.map((s, i) => ({
          setIndex: i + 1,
          reps: s.reps,
          weightKg: s.weightKg,
          rpe: s.rpe,
          isWarmup: s.isWarmup,
        })),
      })),
    }

    const result = await saveSession(payload)

    if (!result.ok) {
      toast.error(result.error)
      setIsSubmitting(false)
      return
    }

    if (result.newPRs.length > 0) {
      result.newPRs.forEach((pr) => {
        const label =
          pr.type === "e1rm"
            ? `e1RM ${pr.value.toFixed(1)} kg`
            : `${pr.value} kg top set`
        toast.success(`🎉 PR — ${pr.exerciseName}: ${label}`)
      })
    } else {
      toast.success("Session saved!")
    }

    router.push("/strength")
  }

  const hasEntries = entries.length > 0

  return (
    <div className="flex flex-col gap-4 pb-24">
      {/* Header fields */}
      <div className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-muted-foreground">
            Date
          </label>
          <input
            type="date"
            value={date}
            max={defaultDate}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-muted-foreground">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="How did it go?"
            className="w-full resize-none rounded-md border px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Exercise entries */}
      {entries.map((entry) => {
        return (
          <div key={entry.id} className="rounded-xl border p-3">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="font-semibold">{entry.exercise.name}</p>
                {entry.exercise.primaryMuscle && (
                  <p className="text-xs text-muted-foreground capitalize">
                    {entry.exercise.primaryMuscle}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeEntry(entry.id)}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                Remove
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {entry.sets.map((set, idx) => {
                const nonWarmupIdx = entry.sets
                  .slice(0, idx + 1)
                  .filter((s) => !s.isWarmup).length
                return (
                  <SetRow
                    key={set.id}
                    set={set}
                    setNumber={nonWarmupIdx}
                    onChange={(changes) => updateSet(entry.id, set.id, changes)}
                    onDelete={() => removeSet(entry.id, set.id)}
                  />
                )
              })}
            </div>

            <div className="mt-2 flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => addSet(entry.id, false)}
              >
                + Set
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={entry.sets.length === 0}
                onClick={() => addSet(entry.id, true)}
              >
                Same as last
              </Button>
            </div>
          </div>
        )
      })}

      {/* Add exercise button */}
      <Button
        type="button"
        variant="outline"
        className="gap-2"
        onClick={() => setSheetOpen(true)}
      >
        <Plus className="h-4 w-4" />
        Add exercise
      </Button>

      {!hasEntries && (
        <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
          <Dumbbell className="h-8 w-8" />
          <p className="text-sm">Tap &quot;Add exercise&quot; to start logging</p>
        </div>
      )}

      {/* Exercise picker sheet */}
      <ExerciseSearchSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        exercises={exercises}
        onSelect={addEntry}
        onExerciseCreated={(ex) => setExercises((prev) => [...prev, ex])}
      />

      {/* Sticky End session bar */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background px-4 py-3 md:static md:border-0 md:bg-transparent md:p-0">
        <Button
          className="w-full"
          size="lg"
          onClick={handleSubmit}
          disabled={isSubmitting || !hasEntries}
        >
          {isSubmitting ? "Saving..." : "End session"}
        </Button>
      </div>
    </div>
  )
}
