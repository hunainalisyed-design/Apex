import "dotenv/config";
import { initSentry } from "./lib/sentry.js";

// Must run before anything else that might throw (Spec 22, AC-3).
initSentry();

const { createApp } = await import("./app.js");
const { logger } = await import("./lib/logger.js");
const { startComboRarityJob } = await import("./jobs/computeComboRarity.js");
const { attachLiveSessionServer } = await import("./ws/liveSession.js");

const port = Number(process.env.PORT ?? 4000);
const app = createApp();

const server = app.listen(port, () => {
  logger.info({ port }, "[backend] listening");
  // Spec 32: the hourly paint + wheels rarity aggregation.
  startComboRarityJob();
});

// Spec 33: live sessions share the API's port, on /ws/live-sessions/:sessionId.
attachLiveSessionServer(server, { allowedOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:3000" });
