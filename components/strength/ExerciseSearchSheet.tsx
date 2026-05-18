"use client"

import { useState, useTransition } from "react"
import { Search, Plus, Dumbbell, ChevronLeft } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { addExercise } from "@/app/(app)/strength/actions"
import type { Exercise } from "@/lib/db/queries/strength"

const MUSCLES = [
  "chest", "back", "shoulders", "biceps", "triceps",
  "quads", "hamstrings", "glutes", "calves", "core",
]
const EQUIPMENT = ["barbell", "dumbbell", "cable", "machine", "bodyweight"]

type Props = {
  open: boolean
  onClose: () => void
  exercises: Exercise[]
  onSelect: (exercise: Exercise) => void
  onExerciseCreated: (exercise: Exercise) => void
}

export function ExerciseSearchSheet({
  open,
  onClose,
  exercises,
  onSelect,
  onExerciseCreated,
}: Props) {
  const [query, setQuery] = useState("")
  const [isPending, startTransition] = useTransition()

  // Create flow state
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [newMuscle, setNewMuscle] = useState("")
  const [newEquipment, setNewEquipment] = useState("")

  const filtered = exercises.filter(
    (e) =>
      e.name.toLowerCase().includes(query.toLowerCase()) ||
      (e.primaryMuscle ?? "").toLowerCase().includes(query.toLowerCase()),
  )

  const exactMatch = exercises.some(
    (e) => e.name.toLowerCase() === query.toLowerCase(),
  )
  const showCreateOption = query.trim().length > 1 && !exactMatch

  function handleSelect(exercise: Exercise) {
    onSelect(exercise)
    resetAndClose()
  }

  function resetAndClose() {
    setQuery("")
    setCreating(false)
    setNewName("")
    setNewMuscle("")
    setNewEquipment("")
    onClose()
  }

  function openCreateForm() {
    setNewName(query.trim())
    setCreating(true)
  }

  function handleSaveNew() {
    startTransition(async () => {
      const result = await addExercise({
        name: newName.trim(),
        primaryMuscle: newMuscle || undefined,
        equipment: newEquipment || undefined,
      })
      if (result.ok) {
        onExerciseCreated(result.exercise)
        onSelect(result.exercise)
        resetAndClose()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && resetAndClose()}>
      <DialogContent className="flex h-[70vh] max-w-md flex-col gap-0 p-0">

        {/* ── Search view ── */}
        {!creating && (
          <>
            <DialogHeader className="border-b px-4 py-3">
              <DialogTitle>Add exercise</DialogTitle>
            </DialogHeader>

            <div className="flex items-center gap-2 border-b px-4 py-2">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Search or create..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="border-0 p-0 shadow-none focus-visible:ring-0"
              />
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-1">
              {showCreateOption && (
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2 text-left"
                  onClick={openCreateForm}
                >
                  <Plus className="h-4 w-4" />
                  Create &ldquo;{query.trim()}&rdquo;
                </Button>
              )}

              {filtered.map((exercise) => (
                <button
                  key={exercise.id}
                  type="button"
                  onClick={() => handleSelect(exercise)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left hover:bg-accent"
                >
                  <Dumbbell className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 font-medium">{exercise.name}</span>
                  {exercise.primaryMuscle && (
                    <Badge variant="secondary" className="text-xs">
                      {exercise.primaryMuscle}
                    </Badge>
                  )}
                </button>
              ))}

              {filtered.length === 0 && !showCreateOption && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No exercises found
                </p>
              )}
            </div>
          </>
        )}

        {/* ── Create view ── */}
        {creating && (
          <>
            <DialogHeader className="border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <DialogTitle>New exercise</DialogTitle>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="flex flex-col gap-5">

                {/* Name */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Name</label>
                  <Input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Cable Fly"
                  />
                </div>

                {/* Muscle group */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">
                    Muscle group <span className="text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {MUSCLES.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setNewMuscle(newMuscle === m ? "" : m)}
                        className={`rounded-full border px-3 py-1 text-sm capitalize transition-colors ${
                          newMuscle === m
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border hover:bg-accent"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Equipment */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">
                    Equipment <span className="text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {EQUIPMENT.map((eq) => (
                      <button
                        key={eq}
                        type="button"
                        onClick={() => setNewEquipment(newEquipment === eq ? "" : eq)}
                        className={`rounded-full border px-3 py-1 text-sm capitalize transition-colors ${
                          newEquipment === eq
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border hover:bg-accent"
                        }`}
                      >
                        {eq}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t px-4 py-3">
              <Button
                className="w-full"
                onClick={handleSaveNew}
                disabled={isPending || newName.trim().length === 0}
              >
                {isPending ? "Saving…" : "Save exercise"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
