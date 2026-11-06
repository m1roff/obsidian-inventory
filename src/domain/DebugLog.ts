/**
 * A trace of what the plugin does, kept only while the owner has switched the debug log on.
 * Writing to it must never throw or slow the caller down: it is a diagnostic aid.
 */
export interface DebugLog {
  /** Whether lines are being kept now; callers use it to skip work that only feeds the log. */
  readonly enabled: boolean;
  write(scope: string, message: string, details?: Record<string, unknown>): void;
}

/** The log that is off: what the code gets when no one asked for a trace. */
export const NO_DEBUG_LOG: DebugLog = {
  enabled: false,
  write: () => undefined,
};

/** One line of the log: `2026-11-06T12:00:00.000Z [scope] message {"key":"value"}`. */
export function formatLogLine(
  at: Date,
  scope: string,
  message: string,
  details?: Record<string, unknown>,
): string {
  const tail = details === undefined ? "" : ` ${serialize(details)}`;
  return `${at.toISOString()} [${scope}] ${message}${tail}`;
}

/** An error as text: its stack when there is one, never an empty value. */
export function describeError(error: unknown): string {
  if (error instanceof Error) return error.stack ?? `${error.name}: ${error.message}`;
  return String(error);
}

function serialize(details: Record<string, unknown>): string {
  try {
    return JSON.stringify(details);
  } catch {
    return "(details could not be written)";
  }
}
