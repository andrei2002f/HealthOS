import "server-only";

import { formatInTimeZone } from "date-fns-tz";

import { getLast7Days, getTodayStats } from "@/lib/db/queries/dashboard";
import { getRecentCheckins } from "@/lib/db/queries/checkin";
import { getActiveSupplements, getExperiments } from "@/lib/db/queries/supplements";
import { getBasketballSessions } from "@/lib/db/queries/basketball";
import {
  getStrengthSessions,
  getStrengthSession,
} from "@/lib/db/queries/strength";

const TZ = "Europe/Bucharest";

function fmt(d: Date | null | undefined): string {
  if (!d) return "unknown";
  return formatInTimeZone(d, TZ, "yyyy-MM-dd");
}

export async function buildUserContext(userId: string): Promise<string> {
  const [
    todayStats,
    last7Days,
    checkins,
    supplements,
    experiments,
    basketballSessions,
    strengthSummaries,
  ] = await Promise.all([
    getTodayStats(userId),
    getLast7Days(userId),
    getRecentCheckins(userId, 3),
    getActiveSupplements(userId),
    getExperiments(userId),
    getBasketballSessions(userId, 3),
    getStrengthSessions(userId, 3),
  ]);

  // Load full details for the last 3 strength sessions
  const strengthDetails = await Promise.all(
    strengthSummaries.map((s) => getStrengthSession(userId, s.id)),
  );

  // Active experiments = those without an end date or end date in the future
  const today = new Date();
  const activeExperiments = experiments.filter(
    (e) =>
      e.experiment.endDate === null ||
      new Date(e.experiment.endDate) >= today,
  );

  const lines: string[] = [];

  // ── Today ──────────────────────────────────────────────────────────────────
  lines.push("=== TODAY ===");
  if (todayStats.recoveryScore !== null) {
    lines.push(`Recovery: ${todayStats.recoveryScore}%`);
    lines.push(`HRV (rMSSD): ${todayStats.hrvRmssdMs?.toFixed(1) ?? "n/a"} ms`);
    lines.push(`Resting HR: ${todayStats.restingHeartRate ?? "n/a"} bpm`);
  } else {
    lines.push("Recovery: not yet scored today");
  }
  if (todayStats.sleepPerformancePercent !== null) {
    lines.push(
      `Sleep: ${todayStats.sleepPerformancePercent}% performance, ${todayStats.sleepDurationHours?.toFixed(1) ?? "n/a"}h`,
    );
  }
  if (todayStats.yesterdayStrain !== null) {
    lines.push(`Yesterday strain: ${todayStats.yesterdayStrain.toFixed(1)}`);
  }
  if (todayStats.latestWorkoutName) {
    lines.push(
      `Latest workout: ${todayStats.latestWorkoutName} on ${fmt(todayStats.latestWorkoutAt)}` +
        (todayStats.latestWorkoutStrain
          ? `, strain ${todayStats.latestWorkoutStrain.toFixed(1)}`
          : ""),
    );
  }

  // ── Last 7 days ────────────────────────────────────────────────────────────
  lines.push("\n=== LAST 7 DAYS (daily, oldest → newest) ===");
  lines.push("Date       | Recovery | Sleep %  | Sleep h | Strain");
  lines.push("-----------|----------|----------|---------|--------");
  for (const d of last7Days) {
    lines.push(
      `${d.date} | ${d.recoveryScore ?? "—"}%      | ${d.sleepPerformancePercent ?? "—"}%     | ${d.sleepDurationHours?.toFixed(1) ?? "—"}h    | ${d.strain?.toFixed(1) ?? "—"}`,
    );
  }

  // ── Daily check-ins ────────────────────────────────────────────────────────
  if (checkins.length > 0) {
    lines.push("\n=== LAST 3 DAILY CHECK-INS ===");
    for (const c of checkins) {
      const parts = [
        `Date: ${c.checkDate}`,
        `Mood: ${c.mood ?? "—"}/5`,
        `Energy: ${c.energy ?? "—"}/5`,
        `Soreness: ${c.soreness ?? "—"}/5`,
        `Stress: ${c.stress ?? "—"}/5`,
      ];
      if (c.painAreas && c.painAreas.length > 0) {
        parts.push(`Pain areas: ${c.painAreas.join(", ")}`);
      }
      if (c.notes) parts.push(`Notes: ${c.notes}`);
      lines.push(parts.join(", "));
    }
  }

  // ── Strength ───────────────────────────────────────────────────────────────
  const validDetails = strengthDetails.filter(Boolean);
  if (validDetails.length > 0) {
    lines.push("\n=== LAST 3 STRENGTH SESSIONS ===");
    for (const detail of validDetails) {
      if (!detail) continue;
      lines.push(`\nSession: ${fmt(detail.session.performedAt)}`);
      if (detail.session.notes) lines.push(`Notes: ${detail.session.notes}`);
      for (const entry of detail.entries) {
        const workSets = entry.sets.filter((s) => !s.isWarmup);
        if (workSets.length === 0) continue;
        const topSet = workSets.reduce((best, s) => {
          const w = parseFloat(s.weightKg ?? "0");
          const bw = parseFloat(best.weightKg ?? "0");
          return w > bw ? s : best;
        });
        lines.push(
          `  ${entry.exerciseName}: ${workSets.length} work sets, top set ${topSet.weightKg}kg × ${topSet.reps} reps`,
        );
      }
    }
  }

  // ── Basketball ─────────────────────────────────────────────────────────────
  if (basketballSessions.length > 0) {
    lines.push("\n=== LAST 3 BASKETBALL SESSIONS ===");
    for (const s of basketballSessions) {
      const result =
        s.teamScore !== null && s.opponentScore !== null
          ? `${s.teamScore}–${s.opponentScore} ${s.teamScore > s.opponentScore ? "W" : s.teamScore < s.opponentScore ? "L" : "D"}`
          : "score not recorded";
      const stats = [
        s.points !== null ? `${s.points}pts` : null,
        s.assists !== null ? `${s.assists}ast` : null,
        s.rebounds !== null ? `${s.rebounds}reb` : null,
      ]
        .filter(Boolean)
        .join(", ");
      lines.push(
        `${fmt(s.playedAt)}: ${result}${stats ? `, ${stats}` : ""}${s.effortRating ? `, effort ${s.effortRating}/10` : ""}`,
      );
    }
  }

  // ── Supplements ────────────────────────────────────────────────────────────
  if (supplements.length > 0) {
    lines.push("\n=== ACTIVE SUPPLEMENTS ===");
    lines.push(supplements.map((s) => s.name).join(", "));
  }

  if (activeExperiments.length > 0) {
    lines.push("\n=== ACTIVE SUPPLEMENT EXPERIMENTS ===");
    for (const e of activeExperiments) {
      lines.push(
        `${e.supplementName}: started ${e.experiment.startDate ?? "unknown"}` +
          (e.experiment.hypothesis ? ` — hypothesis: ${e.experiment.hypothesis}` : ""),
      );
    }
  }

  return lines.join("\n");
}
