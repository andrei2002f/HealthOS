import { cn } from "@/lib/utils";

type Props = {
  score: number | null;
  size?: "sm" | "lg";
};

function recoveryColor(score: number | null): string {
  if (score == null) return "text-muted-foreground bg-muted";
  if (score >= 67) return "text-white bg-green-500 dark:bg-green-600";
  if (score >= 34) return "text-white bg-yellow-500 dark:bg-yellow-600";
  return "text-white bg-red-500 dark:bg-red-600";
}

export function RecoveryBadge({ score, size = "sm" }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-bold tabular-nums",
        recoveryColor(score),
        size === "lg" ? "h-16 w-16 text-2xl" : "h-8 w-8 text-sm",
      )}
    >
      {score ?? "—"}
    </span>
  );
}
