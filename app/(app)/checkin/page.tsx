import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { parseISO } from "date-fns";

import { getCachedUser } from "@/lib/supabase/server";
import { getCheckin } from "@/lib/db/queries/checkin";
import { CheckinForm } from "@/components/checkin/CheckinForm";
import { DateNav } from "@/components/checkin/DateNav";

const TZ = "Europe/Bucharest";

type Props = {
  searchParams: Promise<{ date?: string }>;
};

export default async function CheckinPage({ searchParams }: Props) {
  const user = await getCachedUser();

  const today = formatInTimeZone(new Date(), TZ, "yyyy-MM-dd");
  const { date: rawDate } = await searchParams;

  // Validate the date param — fall back to today if missing or malformed.
  const isValidDate = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate);
  const checkDate = isValidDate ? rawDate : today;

  // Don't allow navigating to the future.
  const effectiveDate = checkDate > today ? today : checkDate;

  const existing = await getCheckin(user!.id, effectiveDate);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← Home
      </Link>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Daily check-in</h1>
          {existing && (
            <span className="text-sm text-indigo-600 dark:text-indigo-400">
              Already logged · editing
            </span>
          )}
        </div>
        <DateNav currentDate={effectiveDate} todayDate={today} />
      </div>

      <CheckinForm
        checkDate={effectiveDate}
        initialMood={existing?.mood ?? 3}
        initialEnergy={existing?.energy ?? 3}
        initialSoreness={existing?.soreness ?? 1}
        initialStress={existing?.stress ?? 2}
        initialPainAreas={existing?.painAreas ?? []}
        initialNotes={existing?.notes ?? ""}
      />
    </div>
  );
}
