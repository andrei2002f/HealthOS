"use client"

import { useState, useTransition } from "react"
import { Search, Plus, Dumbbell } from "lucide-react"

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
    setQuery("")
    onClose()
  }

  function handleCreate() {
    startTransition(async () => {
      const result = await addExercise({ name: query.trim() })
      if (result.ok) {
        onExerciseCreated(result.exercise)
        onSelect(result.exercise)
        setQuery("")
        onClose()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex h-[70vh] max-w-md flex-col gap-0 p-0">
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
              onClick={handleCreate}
              disabled={isPending}
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
      </DialogContent>
    </Dialog>
  )
}
