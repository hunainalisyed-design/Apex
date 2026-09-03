import cors from "cors";
import express from "express";
import { healthRouter } from "./routes/health.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:3000",
    }),
  );
  app.use(express.json());

  app.use("/api", healthRouter);

  return app;
}
