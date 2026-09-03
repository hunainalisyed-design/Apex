import type { Response } from "express";
import type { ApiError } from "../types/api.js";

export function sendApiError(res: Response, status: number, code: string, message: string) {
  const body: ApiError = { code, message };
  res.status(status).json(body);
}
