import { redirect } from "next/navigation"
import Link from "next/link"
import { Settings, ScrollText } from "lucide-react"

import { MainNav } from "@/components/shared/MainNav"
import { Toaster } from "@/components/ui/sonner"
import { Button } from "@/components/ui/button"
import { getCachedUser } from "@/lib/supabase/server"
import { signOut } from "./actions"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCachedUser()

  if (!user) {
    redirect("/login")
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <span className="font-semibold">Health OS</span>
        <div className="hidden md:block">
          <MainNav />
        </div>
        <div className="flex items-center gap-1">
          <Link
            href="/reviews"
            className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
            title="Weekly Reviews"
          >
            <ScrollText className="size-4" />
          </Link>
          <Link
            href="/settings"
            className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
            title="Settings"
          >
            <Settings className="size-4" />
          </Link>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 pb-20 md:pb-4">{children}</main>

      <div className="md:hidden">
        <MainNav />
      </div>

      <Toaster richColors position="top-center" />
    </div>
  )
}
