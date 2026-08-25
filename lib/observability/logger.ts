/**
 * Structured logging.
 *
 * One JSON object per line on stdout, which is what every log collector — the
 * Vercel dashboard, `kubectl logs`, Loki, CloudWatch — can parse without being
 * told a format. The alternative, `console.log` with a bracketed prefix, is
 * only greppable by a human who already knows what to grep for.
 *
 * Hand-written rather than pino: a levelled JSON logger has no genuinely hard
 * part, and writing it keeps redaction explicit rather than hidden in
 * configuration. See docs/DECISIONS.md, ADR-0023.
 */

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

export type LogFields = Record<string, unknown>;

const LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  // Above every emitting level, so nothing is written. Set by the test config:
  // instrumented code logs on every call, and a test run should report test
  // results, not application output.
  silent: 100,
};

function minimumLevel(): number {
  const configured = process.env.LOG_LEVEL as LogLevel | undefined;
  if (configured && configured in LEVELS) return LEVELS[configured];
  return process.env.NODE_ENV === "production" ? LEVELS.info : LEVELS.debug;
}

/**
 * Field names whose values never reach the log.
 *
 * CLAUDE.md forbids logging Whoop tokens, API keys, or the user's email, and a
 * rule that lives in a developer's memory is one accidental spread away from
 * being broken. Matching on the key rather than the value means a token still
 * gets redacted when it is nested inside an object someone logged wholesale.
 */
const SENSITIVE_KEY =
  /(token|secret|password|passwd|api[-_]?key|encryption|authorization|cookie|credential|email)/i;

const REDACTED = "[redacted]";

/** Depth limit: a cyclic or very deep object should not be able to hang a log call. */
const MAX_DEPTH = 6;

function sanitize(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      // Stacks are useful and can be long; the first frames carry the signal.
      stack: value.stack?.split("\n").slice(0, 5).join("\n"),
    };
  }

  if (value instanceof Date) return value.toISOString();

  if (depth >= MAX_DEPTH) return "[truncated]";

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitize(item, depth + 1));
  }

  if (typeof value === "object") {
    const out: LogFields = {};
    for (const [key, nested] of Object.entries(value as LogFields)) {
      out[key] = SENSITIVE_KEY.test(key)
        ? REDACTED
        : sanitize(nested, depth + 1);
    }
    return out;
  }

  return value;
}

export type Logger = {
  debug(event: string, fields?: LogFields): void;
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
  /** Returns a logger that stamps `bound` onto every subsequent line. */
  child(bound: LogFields): Logger;
};

function emit(level: LogLevel, event: string, fields: LogFields): void {
  if (LEVELS[level] < minimumLevel()) return;

  const line = {
    ts: new Date().toISOString(),
    level,
    // A stable, dotted event name — `whoop.sync.finished` — is what makes logs
    // queryable. The human-readable sentence belongs in the fields, if at all.
    event,
    ...(sanitize(fields) as LogFields),
  };

  const serialized = JSON.stringify(line);

  // stderr for warn/error so a collector that splits streams keeps the
  // distinction; both are one line of JSON either way.
  if (level === "error" || level === "warn") {
    process.stderr.write(serialized + "\n");
  } else {
    process.stdout.write(serialized + "\n");
  }
}

function build(bound: LogFields): Logger {
  return {
    debug: (event, fields) => emit("debug", event, { ...bound, ...fields }),
    info: (event, fields) => emit("info", event, { ...bound, ...fields }),
    warn: (event, fields) => emit("warn", event, { ...bound, ...fields }),
    error: (event, fields) => emit("error", event, { ...bound, ...fields }),
    child: (extra) => build({ ...bound, ...extra }),
  };
}

export const log = build({});

/** Exported for tests. */
export const __testing = { sanitize, SENSITIVE_KEY };
