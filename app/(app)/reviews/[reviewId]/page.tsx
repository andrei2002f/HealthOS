import { notFound } from "next/navigation";
import Link from "next/link";
import { addDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { ArrowLeft } from "lucide-react";

import { getCachedUser } from "@/lib/supabase/server";
import { getWeeklyReview } from "@/lib/db/queries/reviews";
import { Markdown } from "@/components/shared/Markdown";

const TZ = "Europe/Bucharest";

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ reviewId: string }>;
}) {
  const { reviewId } = await params;

  const user = await getCachedUser();

  if (!user) notFound();

  const review = await getWeeklyReview(user.id, reviewId);
  if (!review) notFound();

  const start = new Date(`${review.weekStart}T00:00:00`);
  const end = addDays(start, 6);
  const weekLabel = `${formatInTimeZone(start, TZ, "MMM d")} – ${formatInTimeZone(end, TZ, "MMM d, yyyy")}`;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href="/reviews"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="text-xl font-semibold">{weekLabel}</h1>
      </div>

      <p className="text-xs text-muted-foreground">
        Generated{" "}
        {formatInTimeZone(review.generatedAt, TZ, "MMM d, yyyy 'at' HH:mm")}
      </p>

      <div className="border rounded-lg p-4">
        <Markdown content={review.contentMd} />
      </div>
    </div>
  );
}
