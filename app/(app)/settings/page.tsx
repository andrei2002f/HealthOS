import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, RefreshCw, Unplug, WifiOff } from "lucide-react";
import type { SearchParams } from "next/dist/server/request/search-params";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getRecentSyncLogs, getWhoopCredentials } from "@/lib/db/queries/whoop";
import { getCachedUser } from "@/lib/supabase/server";

import { disconnectWhoop, syncNow } from "./actions";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const user = await getCachedUser();

  if (!user) return null;

  const [creds, logs] = await Promise.all([
    getWhoopCredentials(user.id),
    getRecentSyncLogs(user.id, 10),
  ]);

  const isConnected = Boolean(creds);
  const banner =
    "connected" in params
      ? { type: "success" as const, message: "Whoop connected successfully." }
      : "synced" in params
        ? { type: "success" as const, message: "Sync complete." }
        : "sync_error" in params
          ? { type: "error" as const, message: "Sync failed — check logs below." }
          : "error" in params
            ? {
                type: "error" as const,
                message: `Connection failed (${params.error}).`,
              }
            : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <h1 className="text-2xl font-semibold">Settings</h1>

      {banner && (
        <p
          className={`rounded-md px-4 py-2 text-sm ${
            banner.type === "success"
              ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
              : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
          }`}
        >
          {banner.message}
        </p>
      )}

      {/* Whoop connection card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isConnected ? (
              <span className="h-2 w-2 rounded-full bg-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-muted-foreground" />
            )}
            Whoop
          </CardTitle>
          <CardDescription>
            {isConnected
              ? `Connected · Last synced: ${
                  creds?.lastSyncedAt
                    ? formatDistanceToNow(creds.lastSyncedAt, {
                        addSuffix: true,
                      })
                    : "never"
                }`
              : "Connect your Whoop account to start syncing biometric data."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {isConnected ? (
            <>
              <form action={syncNow}>
                <Button type="submit" size="sm">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sync now
                </Button>
              </form>
              <form action={disconnectWhoop}>
                <Button type="submit" variant="destructive" size="sm">
                  <Unplug className="mr-2 h-4 w-4" />
                  Disconnect
                </Button>
              </form>
            </>
          ) : (
            <Button asChild size="sm">
              <a href="/api/whoop/authorize">Connect Whoop</a>
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Sync history */}
      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sync history</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border text-sm">
              {logs.map((log) => (
                <li key={log.id} className="flex items-start gap-3 py-2">
                  <span className="mt-0.5 shrink-0">
                    {log.status === "success" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : log.status === "error" ? (
                      <span className="text-base leading-none text-red-500">
                        ✗
                      </span>
                    ) : (
                      <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          log.status === "success"
                            ? "default"
                            : log.status === "error"
                              ? "destructive"
                              : "secondary"
                        }
                        className="text-xs"
                      >
                        {log.status}
                      </Badge>
                      <span className="text-muted-foreground">
                        {formatDistanceToNow(log.startedAt, {
                          addSuffix: true,
                        })}
                      </span>
                      {log.recordsSynced != null && (
                        <span className="text-muted-foreground">
                          · {log.recordsSynced} records
                        </span>
                      )}
                    </div>
                    {log.error && (
                      <p className="mt-0.5 truncate text-xs text-red-500">
                        {log.error}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
