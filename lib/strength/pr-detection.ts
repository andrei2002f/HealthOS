export type SetInput = {
  weightKg: number
  reps: number
  setIndex: number
}

export function calculateE1rm(weightKg: number, reps: number): number {
  if (reps <= 0) return 0
  if (reps === 1) return weightKg
  return weightKg * (1 + reps / 30)
}

export function findBestE1rm(
  sets: SetInput[],
): { e1rm: number; set: SetInput } | null {
  if (sets.length === 0) return null
  let best: { e1rm: number; set: SetInput } | null = null
  for (const set of sets) {
    const e1rm = calculateE1rm(set.weightKg, set.reps)
    if (!best || e1rm > best.e1rm) {
      best = { e1rm, set }
    }
  }
  return best
}

export function findTopSet(sets: SetInput[]): SetInput | null {
  if (sets.length === 0) return null
  let top: SetInput | null = null
  for (const set of sets) {
    if (!top || set.weightKg > top.weightKg) {
      top = set
    }
  }
  return top
}
