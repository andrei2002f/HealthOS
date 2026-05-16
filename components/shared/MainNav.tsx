"use client";

import {
  Dumbbell,
  Home,
  MessageCircle,
  Pill,
  Volleyball,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/strength", label: "Strength", icon: Dumbbell },
  { href: "/basketball", label: "Basketball", icon: Volleyball },
  { href: "/supplements", label: "Supplements", icon: Pill },
  { href: "/coach", label: "Coach", icon: MessageCircle },
] as const;

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Bottom tab bar on mobile, inline horizontal links on desktop. */
export function MainNav() {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 flex border-t bg-background",
        "md:static md:border-0 md:bg-transparent",
      )}
    >
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2 text-xs",
              "md:flex-none md:flex-row md:gap-2 md:px-3 md:py-1.5 md:text-sm",
              "transition-colors",
              active
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-5 md:size-4" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
