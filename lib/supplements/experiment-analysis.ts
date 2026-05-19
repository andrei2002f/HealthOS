export type DayMetrics = {
  recovery: number | null
  hrv: number | null
  sleepPerformance: number | null
}

export type HealthDay = { date: string } & DayMetrics // date = YYYY-MM-DD

export type MetricComparison = {
  inside: number | null
  outside: number | null
  delta: number | null // inside - outside
}

export type ExperimentComparison = {
  recovery: MetricComparison
  hrv: MetricComparison
  sleepPerformance: MetricComparison
  insideDayCount: number
  outsideDayCount: number
}

function average(values: Array<number | null>): number | null {
  const present = values.filter((v): v is number => v !== null)
  if (present.length === 0) return null
  return present.reduce((sum, v) => sum + v, 0) / present.length
}

/**
 * Splits health days into those inside the experiment window [startDate, endDate]
 * and those outside it. Bounds are inclusive YYYY-MM-DD strings; an open-ended
 * experiment passes `endDate` as today's date.
 */
export function partitionDays(
  days: HealthDay[],
  startDate: string,
  endDate: string,
): { inside: HealthDay[]; outside: HealthDay[] } {
  const inside: HealthDay[] = []
  const outside: HealthDay[] = []
  for (const day of days) {
    if (day.date >= startDate && day.date <= endDate) inside.push(day)
    else outside.push(day)
  }
  return { inside, outside }
}

export function compareExperiment(
  inside: DayMetrics[],
  outside: DayMetrics[],
): ExperimentComparison {
  const compare = (key: keyof DayMetrics): MetricComparison => {
    const insideAvg = average(inside.map((d) => d[key]))
    const outsideAvg = average(outside.map((d) => d[key]))
    return {
      inside: insideAvg,
      outside: outsideAvg,
      delta:
        insideAvg !== null && outsideAvg !== null
          ? insideAvg - outsideAvg
          : null,
    }
  }

  return {
    recovery: compare("recovery"),
    hrv: compare("hrv"),
    sleepPerformance: compare("sleepPerformance"),
    insideDayCount: inside.length,
    outsideDayCount: outside.length,
  }
}
