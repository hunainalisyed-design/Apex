import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import type { HealthResponse } from "../types/health.js";

export const healthRouter = Router();

healthRouter.get("/health", async (_req, res) => {
  const uptimeSeconds = Math.floor(process.uptime());

  try {
    await prisma.$queryRaw`SELECT 1`;
    const body: HealthResponse = { status: "ok", database: "connected", uptimeSeconds };
    res.status(200).json(body);
  } catch {
    const body: HealthResponse = { status: "degraded", database: "unreachable", uptimeSeconds };
    res.status(503).json(body);
  }
});
