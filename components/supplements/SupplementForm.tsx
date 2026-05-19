"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { addSupplement, editSupplement } from "@/app/(app)/supplements/actions"

const CATEGORIES = [
  "vitamin",
  "mineral",
  "protein",
  "adaptogen",
  "nootropic",
  "other",
] as const

const DOSE_UNITS = ["mg", "g", "iu", "ml", "capsule"] as const

export type SupplementFormInitial = {
  name: string
  defaultDose: string
  doseUnit: string
  category: string
  costPerServingRon: string
  notes: string
}

type Props = {
  mode: "create" | "edit"
  supplementId?: string
  initial: SupplementFormInitial
}

function toNumber(v: string): number | null {
  const trimmed = v.trim()
  if (trimmed === "") return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

export function SupplementForm({ mode, supplementId, initial }: Props) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [form, setForm] = useState<SupplementFormInitial>(initial)

  const set = (key: keyof SupplementFormInitial, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.name.trim() === "") {
      toast.error("Name is required")
      return
    }
    setPending(true)

    const payload = {
      name: form.name.trim(),
      defaultDose: toNumber(form.defaultDose),
      doseUnit: form.doseUnit || undefined,
      category: form.category || undefined,
      costPerServingRon: toNumber(form.costPerServingRon),
      notes: form.notes.trim() || undefined,
    }

    const result =
      mode === "edit" && supplementId
        ? await editSupplement({ ...payload, supplementId })
        : await addSupplement(payload)

    setPending(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }

    toast.success(mode === "edit" ? "Supplement updated" : "Supplement added")
    router.push("/supplements")
    router.refresh()
  }

  const inputClass =
    "w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium">
          Name
        </label>
        <input
          id="name"
          type="text"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. Vitamin D3"
          className={inputClass}
        />
      </div>

      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="defaultDose" className="text-sm font-medium">
            Default dose
          </label>
          <input
            id="defaultDose"
            type="text"
            inputMode="decimal"
            value={form.defaultDose}
            onChange={(e) => set("defaultDose", e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex w-28 flex-col gap-1">
          <label htmlFor="doseUnit" className="text-sm font-medium">
            Unit
          </label>
          <select
            id="doseUnit"
            value={form.doseUnit}
            onChange={(e) => set("doseUnit", e.target.value)}
            className={inputClass}
          >
            <option value="">—</option>
            {DOSE_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Category</p>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const active = form.category === c
            return (
              <button
                key={c}
                type="button"
                onClick={() => set("category", active ? "" : c)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors",
                  active
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-border bg-background text-foreground hover:bg-muted",
                )}
              >
                {c}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="cost" className="text-sm font-medium">
          Cost per serving (RON)
        </label>
        <input
          id="cost"
          type="text"
          inputMode="decimal"
          value={form.costPerServingRon}
          onChange={(e) => set("costPerServingRon", e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="notes" className="text-sm font-medium">
          Notes (optional)
        </label>
        <textarea
          id="notes"
          rows={3}
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          className={inputClass}
        />
      </div>

      <Button type="submit" disabled={pending} className="w-full">
        {pending
          ? "Saving…"
          : mode === "edit"
            ? "Update supplement"
            : "Add supplement"}
      </Button>
    </form>
  )
}
