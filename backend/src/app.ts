import cors from "cors";
import express from "express";
import { aiRouter } from "./routes/ai.js";
import { configurationsRouter } from "./routes/configurations.js";
import { healthRouter } from "./routes/health.js";
import { pricingRouter } from "./routes/pricing.js";
import { vehiclesRouter } from "./routes/vehicles.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:3000",
    }),
  );
  app.use(express.json());

  app.use("/api", healthRouter);
  app.use("/api", vehiclesRouter);
  app.use("/api", pricingRouter);
  app.use("/api", configurationsRouter);
  app.use("/api", aiRouter);

  return app;
}
