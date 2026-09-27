import { logger } from "../lib/logger.js";
import { computeComboRarity } from "../services/comboRarity.js";

const DEFAULT_INTERVAL_MINUTES = 60;
/** Lets the server finish starting (and the DB pool warm up) before the first run. */
const STARTUP_DELAY_MS = 10_000;

let running = false;

/** One aggregation run (Spec 32, AC-1), logged either way; overlapping runs are skipped. */
export async function runComboRarityJob(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const summary = await computeComboRarity();
    logger.info(summary, "[jobs] combo rarity computed");
  } catch (err) {
    logger.error({ err }, "[jobs] combo rarity failed");
  } finally {
    running = false;
  }
}

/**
 * Schedules the aggregation in-process: once shortly after startup, then every
 * RARITY_JOB_INTERVAL_MINUTES (default 60; 0 disables it). There's no job runner in this
 * backend, and one cheap grouped query an hour doesn't justify adding one. Timers are unref'd
 * so they never keep the process alive on shutdown. Returns a function that stops it.
 */
export function startComboRarityJob(env: NodeJS.ProcessEnv = process.env): () => void {
  const raw = env.RARITY_JOB_INTERVAL_MINUTES;
  const minutes = raw === undefined || raw === "" ? DEFAULT_INTERVAL_MINUTES : Number(raw);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    logger.info("[jobs] combo rarity job disabled");
    return () => {};
  }

  let interval: NodeJS.Timeout | undefined;
  const startup = setTimeout(() => {
    void runComboRarityJob();
    interval = setInterval(() => void runComboRarityJob(), minutes * 60_000);
    interval.unref();
  }, STARTUP_DELAY_MS);
  startup.unref();

  return () => {
    clearTimeout(startup);
    if (interval) clearInterval(interval);
  };
}
