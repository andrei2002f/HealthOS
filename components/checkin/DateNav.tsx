"use client";

import { useRouter } from "next/navigation";
import { format, addDays, subDays, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";

type Props = {
  currentDate: string; // YYYY-MM-DD
  todayDate: string;   // YYYY-MM-DD
};

export function DateNav({ currentDate, todayDate }: Props) {
  const router = useRouter();
  const current = parseISO(currentDate);
  const isToday = currentDate === todayDate;

  const go = (date: Date) => {
    const key = format(date, "yyyy-MM-dd");
    router.push(key === todayDate ? "/checkin" : `/checkin?date=${key}`);
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => go(subDays(current, 1))}
        aria-label="Previous day"
        className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-sm hover:bg-muted"
      >
        ←
      </button>
      <span className="min-w-[8rem] text-center text-sm font-medium">
        {isToday ? "Today" : format(current, "EEE, d MMM")}
      </span>
      <button
        onClick={() => go(addDays(current, 1))}
        disabled={isToday}
        aria-label="Next day"
        className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
      >
        →
      </button>
    </div>
  );
}
