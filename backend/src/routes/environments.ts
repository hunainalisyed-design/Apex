import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import { listEnvironments } from "../services/environments.js";
import type { ApiResponse } from "../types/api.js";
import type { EnvironmentDto } from "../types/environments.js";

export const environmentsRouter = Router();

/** Spec 28, AC-1: the scenes the showroom switcher offers. */
environmentsRouter.get(
  "/environments",
  asyncHandler(async (_req, res) => {
    const responseBody: ApiResponse<EnvironmentDto[]> = { data: await listEnvironments() };
    res.status(200).json(responseBody);
  }),
);
