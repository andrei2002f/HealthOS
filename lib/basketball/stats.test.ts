import { describe, it, expect } from "vitest"
import { computeBasketballStats, type BasketballSessionStat } from "./stats"

function session(
  partial: Partial<BasketballSessionStat>,
): BasketballSessionStat {
  return {
    teamScore: null,
    opponentScore: null,
    points: null,
    assists: null,
    rebounds: null,
    minutesPlayed: null,
    ...partial,
  }
}

describe("computeBasketballStats", () => {
  it("returns zeroed stats for no sessions", () => {
    const stats = computeBasketballStats([])
    expect(stats.totalGames).toBe(0)
    expect(stats.winRate).toBeNull()
    expect(stats.avgPoints).toBeNull()
    expect(stats.pointsPerMinute).toBeNull()
  })

  it("counts wins and losses, ignoring draws and unscored games", () => {
    const stats = computeBasketballStats([
      session({ teamScore: 21, opponentScore: 15 }), // win
      session({ teamScore: 10, opponentScore: 18 }), // loss
      session({ teamScore: 11, opponentScore: 11 }), // draw
      session({ teamScore: null, opponentScore: null }), // unscored
    ])
    expect(stats.totalGames).toBe(4)
    expect(stats.wins).toBe(1)
    expect(stats.losses).toBe(1)
    expect(stats.winRate).toBe(0.5)
  })

  it("averages box-score stats only over sessions that have them", () => {
    const stats = computeBasketballStats([
      session({ points: 20, assists: 4 }),
      session({ points: 10 }),
      session({}),
    ])
    expect(stats.avgPoints).toBe(15)
    expect(stats.avgAssists).toBe(4)
    expect(stats.avgRebounds).toBeNull()
  })

  it("computes points per minute over total minutes", () => {
    const stats = computeBasketballStats([
      session({ points: 20, minutesPlayed: 40 }),
      session({ points: 10, minutesPlayed: 10 }),
    ])
    expect(stats.totalMinutes).toBe(50)
    expect(stats.pointsPerMinute).toBeCloseTo(0.6, 5)
  })
})
