"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { archiveSupplementAction } from "@/app/(app)/supplements/actions"

type Props = {
  supplementId: string
}

export function ArchiveButton({ supplementId }: Props) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function archive() {
    setPending(true)
    const result = await archiveSupplementAction(supplementId)
    setPending(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Supplement archived")
    router.push("/supplements")
    router.refresh()
  }

  return (
    <Button
      size="sm"
      variant="destructive"
      disabled={pending}
      onClick={archive}
    >
      {pending ? "Archiving…" : "Archive supplement"}
    </Button>
  )
}
