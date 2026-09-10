import type { Response } from "express";
import type { ApiError } from "../types/api.js";

export function sendApiError(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: Record<string, string[]>,
) {
  const body: ApiError = details ? { code, message, details } : { code, message };
  res.status(status).json(body);
}
