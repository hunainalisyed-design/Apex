import pino from "pino";

/**
 * The one structured logger for this backend (Spec 22, AC-4). JSON lines in every
 * environment except local dev, where pino-pretty makes them human-readable in the
 * terminal — same "production is the real behavior, dev gets a nicer view" split as this
 * codebase's other dev-only fallbacks (e.g. auth/email.ts logging the reset link instead of
 * sending a real email). Never call this with raw request bodies or user-supplied objects
 * directly — pass them through redact() first (see src/lib/redact.ts).
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  transport:
    process.env.NODE_ENV === "production"
      ? undefined
      : { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" } },
});
