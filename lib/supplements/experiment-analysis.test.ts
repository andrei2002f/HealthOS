import { describe, it, expect } from "vitest"
import {
  partitionDays,
  compareExperiment,
  type HealthDay,
} from "./experiment-analysis"

function day(date: string, recovery: number | null): HealthDay {
  return { date, recovery, hrv: null, sleepPerformance: null }
}

describe("partitionDays", () => {
  const days = [
    day("2026-05-01", 50),
    day("2026-05-10", 60),
    day("2026-05-20", 70),
  ]

  it("splits inclusively on the window bounds", () => {
    const { inside, outside } = partitionDays(days, "2026-05-10", "2026-05-20")
    expect(inside.map((d) => d.date)).toEqual(["2026-05-10", "2026-05-20"])
    expect(outside.map((d) => d.date)).toEqual(["2026-05-01"])
  })

  it("puts everything outside when the window misses all data", () => {
    const { inside, outside } = partitionDays(days, "2026-06-01", "2026-06-30")
    expect(inside).toHaveLength(0)
    expect(outside).toHaveLength(3)
  })
})

describe("compareExperiment", () => {
  it("computes per-metric averages and delta", () => {
    const result = compareExperiment(
      [
        { recovery: 80, hrv: 100, sleepPerformance: 90 },
        { recovery: 70, hrv: 90, sleepPerformance: null },
      ],
      [{ recovery: 60, hrv: null, sleepPerformance: 50 }],
    )
    expect(result.recovery.inside).toBe(75)
    expect(result.recovery.outside).toBe(60)
    expect(result.recovery.delta).toBe(15)
    expect(result.insideDayCount).toBe(2)
    expect(result.outsideDayCount).toBe(1)
  })

  it("returns null delta when one side has no data", () => {
    const result = compareExperiment(
      [{ recovery: 80, hrv: null, sleepPerformance: null }],
      [{ recovery: null, hrv: null, sleepPerformance: null }],
    )
    expect(result.recovery.inside).toBe(80)
    expect(result.recovery.outside).toBeNull()
    expect(result.recovery.delta).toBeNull()
  })
})
