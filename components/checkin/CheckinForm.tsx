"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  submitCheckin,
  type CheckinActionState,
} from "@/app/(app)/checkin/actions";

const PAIN_AREAS: { id: string; label: string }[] = [
  { id: "knee_left", label: "Left knee" },
  { id: "knee_right", label: "Right knee" },
  { id: "lower_back", label: "Lower back" },
  { id: "upper_back", label: "Upper back" },
  { id: "shoulder_left", label: "Left shoulder" },
  { id: "shoulder_right", label: "Right shoulder" },
  { id: "hip_left", label: "Left hip" },
  { id: "hip_right", label: "Right hip" },
  { id: "ankle_left", label: "Left ankle" },
  { id: "ankle_right", label: "Right ankle" },
  { id: "neck", label: "Neck" },
  { id: "wrist_left", label: "Left wrist" },
  { id: "wrist_right", label: "Right wrist" },
];

type SliderFieldProps = {
  name: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  lowLabel: string;
  highLabel: string;
};

function SliderField({
  name,
  label,
  value,
  onChange,
  lowLabel,
  highLabel,
}: SliderFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        <span className="min-w-[1.5rem] text-center text-sm font-bold tabular-nums">
          {value}
        </span>
      </div>
      <input
        type="range"
        name={name}
        min={1}
        max={5}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer accent-indigo-600"
      />
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}

type Props = {
  checkDate: string; // YYYY-MM-DD
  initialMood?: number;
  initialEnergy?: number;
  initialSoreness?: number;
  initialStress?: number;
  initialPainAreas?: string[];
  initialNotes?: string;
};

const initialState: CheckinActionState = { ok: false, error: "" };

export function CheckinForm({
  checkDate,
  initialMood = 3,
  initialEnergy = 3,
  initialSoreness = 1,
  initialStress = 2,
  initialPainAreas = [],
  initialNotes = "",
}: Props) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    submitCheckin,
    initialState,
  );

  const [mood, setMood] = useState(initialMood);
  const [energy, setEnergy] = useState(initialEnergy);
  const [soreness, setSoreness] = useState(initialSoreness);
  const [stress, setStress] = useState(initialStress);
  const [painAreas, setPainAreas] = useState<Set<string>>(
    new Set(initialPainAreas),
  );

  useEffect(() => {
    if (state.ok) router.push("/");
  }, [state, router]);

  const togglePain = (id: string) => {
    setPainAreas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="checkDate" value={checkDate} />
      {/* Sliders pass values via hidden inputs because range values are
          managed in state; the hidden inputs shadow the range names. */}
      <input type="hidden" name="mood" value={mood} />
      <input type="hidden" name="energy" value={energy} />
      <input type="hidden" name="soreness" value={soreness} />
      <input type="hidden" name="stress" value={stress} />

      <div className="flex flex-col gap-5 rounded-xl border p-4">
        <SliderField
          name="_mood"
          label="Mood"
          value={mood}
          onChange={setMood}
          lowLabel="Very low"
          highLabel="Excellent"
        />
        <SliderField
          name="_energy"
          label="Energy"
          value={energy}
          onChange={setEnergy}
          lowLabel="Drained"
          highLabel="Full tank"
        />
        <SliderField
          name="_soreness"
          label="Soreness"
          value={soreness}
          onChange={setSoreness}
          lowLabel="None"
          highLabel="Very sore"
        />
        <SliderField
          name="_stress"
          label="Stress"
          value={stress}
          onChange={setStress}
          lowLabel="Calm"
          highLabel="Very stressed"
        />
      </div>

      {/* Pain areas */}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">Pain areas (optional)</p>
        <div className="flex flex-wrap gap-2">
          {PAIN_AREAS.map((a) => {
            const active = painAreas.has(a.id);
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => togglePain(a.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-red-500 bg-red-500 text-white"
                    : "border-border bg-background text-foreground hover:bg-muted",
                )}
              >
                {a.label}
              </button>
            );
          })}
        </div>
        {/* Emit one hidden input per selected pain area */}
        {[...painAreas].map((id) => (
          <input key={id} type="hidden" name="painAreas" value={id} />
        ))}
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1">
        <label htmlFor="notes" className="text-sm font-medium">
          Notes (optional)
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={initialNotes}
          placeholder="How are you feeling today?"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {state.ok === false && state.error && (
        <p className="text-sm text-red-500">{state.error}</p>
      )}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Saving…" : "Save check-in"}
      </Button>
    </form>
  );
}
