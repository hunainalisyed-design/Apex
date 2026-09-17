import "dotenv/config";
import { initSentry } from "./lib/sentry.js";

// Must run before anything else that might throw (Spec 22, AC-3).
initSentry();

const { createApp } = await import("./app.js");
const { logger } = await import("./lib/logger.js");

const port = Number(process.env.PORT ?? 4000);
const app = createApp();

app.listen(port, () => {
  logger.info({ port }, "[backend] listening");
});
