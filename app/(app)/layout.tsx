import { redirect } from "next/navigation";

import { MainNav } from "@/components/shared/MainNav";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

/**
 * Authenticated app shell. Middleware already gates access; this is a
 * defense-in-depth check and the place the user object is first loaded.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <span className="font-semibold">Health OS</span>
        <div className="hidden md:block">
          <MainNav />
        </div>
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      </header>

      <main className="flex-1 px-4 py-4 pb-20 md:pb-4">{children}</main>

      <div className="md:hidden">
        <MainNav />
      </div>
    </div>
  );
}
