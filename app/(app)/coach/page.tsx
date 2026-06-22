import { getCachedUser } from "@/lib/supabase/server";
import { getCoachMessages } from "@/lib/db/queries/coach";
import { CoachChat } from "@/components/coach/CoachChat";

export default async function CoachPage() {
  const user = await getCachedUser();

  const messages = user
    ? await getCoachMessages(user.id)
    : [];

  const initialMessages = messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  return (
    <div className="flex flex-col h-[calc(100dvh-8rem)] md:h-[calc(100dvh-7rem)]">
      <CoachChat initialMessages={initialMessages} />
    </div>
  );
}
