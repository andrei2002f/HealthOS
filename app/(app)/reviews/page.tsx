import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { addDays } from "date-fns";

import { getCachedUser } from "@/lib/supabase/server";
import { getWeeklyReviews } from "@/lib/db/queries/reviews";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const TZ = "Europe/Bucharest";

function weekRangeLabel(weekStart: string): string {
  const start = new Date(`${weekStart}T00:00:00`);
  const end = addDays(start, 6);
  const startStr = formatInTimeZone(start, TZ, "MMM d");
  const endStr = formatInTimeZone(end, TZ, "MMM d, yyyy");
  return `${startStr} – ${endStr}`;
}

export default async function ReviewsPage() {
  const user = await getCachedUser();

  const reviews = user ? await getWeeklyReviews(user.id) : [];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Weekly Reviews</h1>

      {reviews.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No weekly reviews yet. The first review is generated automatically every
          Sunday at 8 PM local time.
        </p>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <Link key={review.id} href={`/reviews/${review.id}`}>
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                <CardHeader className="py-4">
                  <CardTitle className="text-base">
                    {weekRangeLabel(review.weekStart)}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Generated{" "}
                    {formatInTimeZone(review.generatedAt, TZ, "MMM d, yyyy 'at' HH:mm")}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
