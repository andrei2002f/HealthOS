"use client"

import { useState, useTransition } from "react"
import { Pencil } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { updateExerciseAction } from "@/app/(app)/strength/actions"
import type { Exercise } from "@/lib/db/queries/strength"

const MUSCLES = [
  "chest", "back", "shoulders", "biceps", "triceps",
  "quads", "hamstrings", "glutes", "calves", "core",
]
const EQUIPMENT = ["barbell", "dumbbell", "cable", "machine", "bodyweight"]

type Props = { exercise: Exercise }

export function EditExerciseForm({ exercise }: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(exercise.name)
  const [muscle, setMuscle] = useState(exercise.primaryMuscle ?? "")
  const [equipment, setEquipment] = useState(exercise.equipment ?? "")
  const [isPending, startTransition] = useTransition()

  function handleOpen() {
    setName(exercise.name)
    setMuscle(exercise.primaryMuscle ?? "")
    setEquipment(exercise.equipment ?? "")
    setOpen(true)
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateExerciseAction({
        exerciseId: exercise.id,
        name: name.trim() || undefined,
        primaryMuscle: muscle || null,
        equipment: equipment || null,
      })
      if (result.ok) setOpen(false)
    })
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={handleOpen}>
        <Pencil className="mr-1.5 h-3.5 w-3.5" />
        Edit
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit exercise</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-5 pt-1">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">
                Muscle group{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {MUSCLES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMuscle(muscle === m ? "" : m)}
                    className={`rounded-full border px-3 py-1 text-sm capitalize transition-colors ${
                      muscle === m
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">
                Equipment{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {EQUIPMENT.map((eq) => (
                  <button
                    key={eq}
                    type="button"
                    onClick={() => setEquipment(equipment === eq ? "" : eq)}
                    className={`rounded-full border px-3 py-1 text-sm capitalize transition-colors ${
                      equipment === eq
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    {eq}
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={handleSave}
              disabled={isPending || name.trim().length === 0}
            >
              {isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
