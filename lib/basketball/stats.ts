export type BasketballSessionStat = {
  teamScore: number | null
  opponentScore: number | null
  points: number | null
  assists: number | null
  rebounds: number | null
  minutesPlayed: number | null
}

export type BasketballStats = {
  totalGames: number
  wins: number
  losses: number
  winRate: number | null // 0-1, over games that have both scores
  avgPoints: number | null
  avgAssists: number | null
  avgRebounds: number | null
  totalMinutes: number
  pointsPerMinute: number | null
}

function average(values: Array<number | null>): number | null {
  const present = values.filter((v): v is number => v !== null)
  if (present.length === 0) return null
  return present.reduce((sum, v) => sum + v, 0) / present.length
}

export function computeBasketballStats(
  sessions: BasketballSessionStat[],
): BasketballStats {
  let wins = 0
  let losses = 0
  let totalMinutes = 0
  let totalPoints = 0

  for (const s of sessions) {
    if (s.teamScore !== null && s.opponentScore !== null) {
      if (s.teamScore > s.opponentScore) wins++
      else if (s.teamScore < s.opponentScore) losses++
    }
    if (s.minutesPlayed !== null) totalMinutes += s.minutesPlayed
    if (s.points !== null) totalPoints += s.points
  }

  const decided = wins + losses

  return {
    totalGames: sessions.length,
    wins,
    losses,
    winRate: decided > 0 ? wins / decided : null,
    avgPoints: average(sessions.map((s) => s.points)),
    avgAssists: average(sessions.map((s) => s.assists)),
    avgRebounds: average(sessions.map((s) => s.rebounds)),
    totalMinutes,
    pointsPerMinute: totalMinutes > 0 ? totalPoints / totalMinutes : null,
  }
}
