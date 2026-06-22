import Link from "next/link"
import { redirect } from "next/navigation"

import { getCachedUser } from "@/lib/supabase/server"
import { SupplementForm } from "@/components/supplements/SupplementForm"

export default async function NewSupplementPage() {
  const user = await getCachedUser()
  if (!user) redirect("/login")

  return (
    <div className="mx-auto max-w-lg">
      <Link
        href="/supplements"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Supplements
      </Link>
      <h1 className="mb-4 mt-2 text-xl font-semibold">Add supplement</h1>
      <SupplementForm
        mode="create"
        initial={{
          name: "",
          defaultDose: "",
          doseUnit: "",
          category: "",
          costPerServingRon: "",
          notes: "",
        }}
      />
    </div>
  )
}
