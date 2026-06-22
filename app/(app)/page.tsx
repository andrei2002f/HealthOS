import Link from "next/link";
import { format } from "date-fns";

import { createClient } from "@/lib/supabase/server";
import { getTodayStats, getLast7Days } from "@/lib/db/queries/dashboard";
import { RecoveryBadge } from "@/components/shared/RecoveryBadge";
import { SparklineChart } from "@/components/charts/SparklineChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TodoWidget } from "@/components/todos/TodoWidget";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user!.id;

  const [today, days7] = await Promise.all([
    getTodayStats(userId),
    getLast7Days(userId),
  ]);

  const recoveryData = days7.map((d) => ({
    date: d.date,
    value: d.recoveryScore,
  }));
  const sleepData = days7.map((d) => ({
    date: d.date,
    value: d.sleepDurationHours,
  }));
  const strainData = days7.map((d) => ({ date: d.date, value: d.strain }));

  const hasAnyData =
    today.recoveryScore != null ||
    today.sleepPerformancePercent != null ||
    today.yesterdayStrain != null;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Today</h1>

      {/* ── Today card ──────────────────────────────────────────────────── */}
      {hasAnyData ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {format(new Date(), "EEEE, d MMMM")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              {/* Recovery */}
              <div className="flex flex-col items-center gap-1">
                <RecoveryBadge score={today.recoveryScore} size="lg" />
                <span className="text-xs text-muted-foreground">Recovery</span>
                {today.hrvRmssdMs != null && (
                  <span className="text-[11px] text-muted-foreground">
                    HRV {today.hrvRmssdMs.toFixed(0)} ms
                  </span>
                )}
                {today.restingHeartRate != null && (
                  <span className="text-[11px] text-muted-foreground">
                    RHR {today.restingHeartRate} bpm
                  </span>
                )}
              </div>

              {/* Sleep */}
              <div className="flex flex-col items-center gap-1">
                <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-2xl font-bold text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
                  {today.sleepPerformancePercent != null
                    ? `${today.sleepPerformancePercent}%`
                    : "—"}
                </span>
                <span className="text-xs text-muted-foreground">Sleep</span>
                {today.sleepDurationHours != null && (
                  <span className="text-[11px] text-muted-foreground">
                    {today.sleepDurationHours}h
                  </span>
                )}
              </div>

              {/* Yesterday strain */}
              <div className="flex flex-col items-center gap-1">
                <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 text-2xl font-bold text-orange-700 dark:bg-orange-900 dark:text-orange-300">
                  {today.yesterdayStrain != null
                    ? today.yesterdayStrain.toFixed(1)
                    : "—"}
                </span>
                <span className="text-xs text-muted-foreground">
                  Yesterday&apos;s Strain
                </span>
              </div>
            </div>

            {/* Latest workout */}
            {today.latestWorkoutName && (
              <div className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm">
                <span className="font-medium capitalize">
                  {today.latestWorkoutName.replace(/_/g, " ")}
                </span>
                {today.latestWorkoutStrain != null && (
                  <span className="ml-2 text-muted-foreground">
                    strain {today.latestWorkoutStrain.toFixed(1)}
                  </span>
                )}
                {today.latestWorkoutAt && (
                  <span className="ml-2 text-muted-foreground">
                    · {format(today.latestWorkoutAt, "MMM d")}
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            No Whoop data yet.{" "}
            <Link href="/settings" className="underline underline-offset-4">
              Connect Whoop
            </Link>{" "}
            or trigger a sync in Settings.
          </CardContent>
        </Card>
      )}

      {/* ── Todos ───────────────────────────────────────────────────────── */}
      <TodoWidget userId={userId} />

      {/* ── 7-day mini charts ──────────────────────────────────────────── */}
      <h2 className="text-sm font-semibold text-muted-foreground">
        Last 7 days
      </h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-1 pt-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Recovery
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <SparklineChart
              data={recoveryData}
              color="#22c55e"
              referenceValue={67}
              unit="%"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 pt-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Sleep (hours)
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <SparklineChart
              data={sleepData}
              color="#6366f1"
              referenceValue={8}
              unit="h"
              decimals={1}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 pt-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Strain
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <SparklineChart
              data={strainData}
              color="#f97316"
              decimals={1}
            />
          </CardContent>
        </Card>
      </div>

      {/* ── Quick actions ───────────────────────────────────────────────── */}
      <h2 className="text-sm font-semibold text-muted-foreground">
        Quick actions
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Button asChild variant="outline" className="h-14 flex-col gap-1">
          <Link href="/checkin">
            <span className="text-lg">📋</span>
            <span className="text-xs">Daily check-in</span>
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-14 flex-col gap-1">
          <Link href="/strength/new">
            <span className="text-lg">🏋️</span>
            <span className="text-xs">Log strength</span>
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-14 flex-col gap-1">
          <Link href="/basketball/new">
            <span className="text-lg">🏀</span>
            <span className="text-xs">Log basketball</span>
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-14 flex-col gap-1">
          <Link href="/supplements">
            <span className="text-lg">💊</span>
            <span className="text-xs">Supplements</span>
          </Link>
        </Button>
      </div>
    </div>
  );
}
