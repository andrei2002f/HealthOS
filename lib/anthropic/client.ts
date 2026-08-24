import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { env } from "@/lib/env";

let cached: Anthropic | undefined;

/**
 * Anthropic SDK client, constructed on first use.
 *
 * Deliberately not a module-level constant: `next build` loads this module
 * while collecting page data for the coach and weekly-review routes, and
 * reading ANTHROPIC_API_KEY at that point would make the build require a real
 * key. See docs/DECISIONS.md, ADR-0003.
 */
export function getAnthropic(): Anthropic {
  return (cached ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }));
}

/** Model id from the environment, read at call time for the same reason. */
export function getModel(): string {
  return env.ANTHROPIC_MODEL;
}
