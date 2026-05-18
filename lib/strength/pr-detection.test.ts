import { describe, it, expect } from "vitest"
import {
  calculateE1rm,
  findBestE1rm,
  findTopSet,
} from "./pr-detection"

describe("calculateE1rm", () => {
  it("returns weight unchanged for 1 rep", () => {
    expect(calculateE1rm(100, 1)).toBe(100)
  })
  it("applies Epley formula for multiple reps", () => {
    // 100 * (1 + 10/30) = 133.33...
    expect(calculateE1rm(100, 10)).toBeCloseTo(133.33, 1)
  })
  it("returns 0 for 0 reps", () => {
    expect(calculateE1rm(100, 0)).toBe(0)
  })
})

describe("findBestE1rm", () => {
  it("returns null for empty array", () => {
    expect(findBestE1rm([])).toBeNull()
  })
  it("picks the set with the highest e1RM", () => {
    const sets = [
      { weightKg: 100, reps: 5, setIndex: 1 }, // e1rm = 116.67
      { weightKg: 80, reps: 10, setIndex: 2 },  // e1rm = 106.67
      { weightKg: 90, reps: 8, setIndex: 3 },   // e1rm = 114.00
    ]
    const result = findBestE1rm(sets)
    expect(result?.set.setIndex).toBe(1)
    expect(result?.e1rm).toBeCloseTo(116.67, 1)
  })
  it("handles single set", () => {
    const sets = [{ weightKg: 60, reps: 1, setIndex: 1 }]
    const result = findBestE1rm(sets)
    expect(result?.e1rm).toBe(60)
  })
})

describe("findTopSet", () => {
  it("returns null for empty array", () => {
    expect(findTopSet([])).toBeNull()
  })
  it("picks the heaviest set by weight", () => {
    const sets = [
      { weightKg: 80, reps: 10, setIndex: 1 },
      { weightKg: 100, reps: 3, setIndex: 2 },
      { weightKg: 90, reps: 5, setIndex: 3 },
    ]
    expect(findTopSet(sets)?.setIndex).toBe(2)
  })
})
