"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Check, X } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { markIntakeAction } from "@/app/(app)/supplements/actions"
import type { SupplementWithStatus } from "@/lib/db/queries/supplements"

type Props = {
  item: SupplementWithStatus
}

export function IntakeRow({ item }: Props) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const { supplement, status } = item

  async function mark(next: "taken" | "skipped" | "undo") {
    setPending(true)
    const result = await markIntakeAction(supplement.id, next)
    setPending(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    router.refresh()
  }

  const doseLabel =
    supplement.defaultDose != null
      ? `${supplement.defaultDose}${supplement.doseUnit ? ` ${supplement.doseUnit}` : ""}`
      : null

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border p-3",
        status === "taken" && "border-green-500/40 bg-green-500/5",
        status === "skipped" && "border-muted bg-muted/40",
      )}
    >
      <Link href={`/supplements/${supplement.id}`} className="min-w-0">
        <p className="truncate font-medium">{supplement.name}</p>
        {doseLabel && (
          <p className="text-xs text-muted-foreground">{doseLabel}</p>
        )}
      </Link>

      {status === "pending" ? (
        <div className="flex shrink-0 gap-2">
          <Button size="sm" disabled={pending} onClick={() => mark("taken")}>
            <Check className="size-4" /> Take
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => mark("skipped")}
          >
            <X className="size-4" /> Skip
          </Button>
        </div>
      ) : (
        <div className="flex shrink-0 items-center gap-3">
          <span
            className={cn(
              "text-sm font-medium",
              status === "taken" ? "text-green-600" : "text-muted-foreground",
            )}
          >
            {status === "taken" ? "Taken" : "Skipped"}
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => mark("undo")}
          >
            Undo
          </Button>
        </div>
      )}
    </div>
  )
}
