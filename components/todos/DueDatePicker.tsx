"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { enGB } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Props = {
  /** Form field name; emits the value as ISO yyyy-MM-dd. */
  name: string;
};

export function DueDatePicker({ name }: Props) {
  const [value, setValue] = useState<Date | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Clear when the surrounding form is reset (e.g. after a successful add).
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const onReset = () => setValue(undefined);
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);

  return (
    <div className="flex items-center gap-1">
      {/* Server Action reads the ISO value from this hidden field. */}
      <input
        ref={inputRef}
        type="hidden"
        name={name}
        value={value ? format(value, "yyyy-MM-dd") : ""}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "w-40 justify-start gap-2 font-normal",
              !value && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="size-4" />
            {value ? format(value, "dd/MM/yyyy") : "Due date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            locale={enGB}
            selected={value}
            onSelect={(date) => {
              setValue(date);
              setOpen(false);
            }}
            autoFocus
          />
        </PopoverContent>
      </Popover>
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Clear due date"
          onClick={() => setValue(undefined)}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </Button>
      )}
    </div>
  );
}
