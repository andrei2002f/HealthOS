"use client"

import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PRBadge } from "./PRBadge"

type DraftSet = {
  id: string
  reps: number
  weightKg: number
  rpe: number | null
  isWarmup: boolean
}

type SetRowProps = {
  set: DraftSet
  setNumber: number
  isPR?: boolean
  onChange: (changes: Partial<DraftSet>) => void
  onDelete: () => void
}

function StepButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-lg border text-lg font-semibold active:scale-95"
    >
      {label}
    </button>
  )
}

export function SetRow({ set, setNumber, isPR, onChange, onDelete }: SetRowProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
      <span className="w-6 text-center text-sm font-medium text-muted-foreground">
        {set.isWarmup ? "W" : setNumber}
      </span>

      {/* Reps */}
      <div className="flex items-center gap-1">
        <StepButton label="−" onClick={() => onChange({ reps: Math.max(1, set.reps - 1) })} />
        <span className="w-8 text-center text-base font-semibold">{set.reps}</span>
        <StepButton label="+" onClick={() => onChange({ reps: set.reps + 1 })} />
      </div>

      <span className="text-muted-foreground">×</span>

      {/* Weight */}
      <div className="flex items-center gap-1">
        <StepButton
          label="−"
          onClick={() => onChange({ weightKg: Math.max(0, parseFloat((set.weightKg - 2.5).toFixed(2))) })}
        />
        <span className="w-14 text-center text-base font-semibold">
          {set.weightKg}
          <span className="ml-0.5 text-xs font-normal text-muted-foreground">kg</span>
        </span>
        <StepButton
          label="+"
          onClick={() => onChange({ weightKg: parseFloat((set.weightKg + 2.5).toFixed(2)) })}
        />
      </div>

      {isPR && <PRBadge />}

      {/* Warmup toggle */}
      <button
        type="button"
        onClick={() => onChange({ isWarmup: !set.isWarmup })}
        className={`ml-auto text-xs font-medium transition-colors ${
          set.isWarmup
            ? "text-blue-600 dark:text-blue-400"
            : "text-muted-foreground"
        }`}
      >
        W
      </button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={onDelete}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}
