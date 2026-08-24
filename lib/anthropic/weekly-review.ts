import "server-only";

import { startOfWeek, subWeeks, formatISO } from "date-fns";
import { toZonedTime } from "date-fns-tz";

import { getAnthropic, getModel } from "./client";
import { WEEKLY_REVIEW_SYSTEM_PROMPT } from "./prompts";
import { buildUserContext } from "./context";

const TZ = "Europe/Bucharest";

/** Returns the Monday (ISO week start) of the last completed week in local time. */
export function lastCompletedWeekStart(): Date {
  const nowLocal = toZonedTime(new Date(), TZ);
  // Go back 1 week, then find the start of that week (Monday)
  const lastWeek = subWeeks(nowLocal, 1);
  return startOfWeek(lastWeek, { weekStartsOn: 1 });
}

/** Formats a Date as YYYY-MM-DD string (for DB storage as a date column). */
export function toDateString(d: Date): string {
  return formatISO(d, { representation: "date" });
}

export async function generateWeeklyReview(
  userId: string,
  weekStart: Date,
): Promise<string> {
  const contextBlock = await buildUserContext(userId);

  const weekStartStr = toDateString(weekStart);

  const userPrompt = `Please generate a weekly review for the week starting ${weekStartStr}.

Here is the user's data for context:

${contextBlock}`;

  const response = await getAnthropic().messages.create({
    model: getModel(),
    max_tokens: 1500,
    system: WEEKLY_REVIEW_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const block = response.content[0];
  if (block.type !== "text") {
    throw new Error("Unexpected response type from Anthropic");
  }
  return block.text;
}
