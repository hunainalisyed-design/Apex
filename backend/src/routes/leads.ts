import { Router } from "express";
import { sendApiError } from "../lib/apiError.js";
import { optionalAuth } from "../middleware/auth.js";
import { leadRateLimit } from "../middleware/rateLimit.js";
import { createLead } from "../services/leads/createLead.js";
import type { ApiResponse } from "../types/api.js";
import type { CreateLeadRequest, LeadDto } from "../types/leads.js";

export const leadsRouter = Router();

// No email-format check exists anywhere else in this backend (Spec 16's signup route only
// checks non-empty) — AC-5 explicitly wants "malformed email" caught, so this is new.
// Mirrors the frontend's own EMAIL_FORMAT pattern (frontend/src/lib/auth/validation.ts).
const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

leadsRouter.post("/leads", leadRateLimit, optionalAuth, async (req, res) => {
  const body = req.body as Partial<CreateLeadRequest> | undefined;

  if (!body || typeof body.configurationPublicId !== "string" || !body.configurationPublicId) {
    sendApiError(res, 400, "VALIDATION_ERROR", "configurationPublicId is required.");
    return;
  }
  if (typeof body.name !== "string" || !body.name.trim()) {
    sendApiError(res, 400, "VALIDATION_ERROR", "name is required.", { name: ["Name is required."] });
    return;
  }
  if (typeof body.email !== "string" || !EMAIL_FORMAT.test(body.email.trim())) {
    sendApiError(res, 400, "VALIDATION_ERROR", "A valid email is required.", { email: ["A valid email is required."] });
    return;
  }
  if (body.preferredContact !== "EMAIL" && body.preferredContact !== "PHONE") {
    sendApiError(res, 400, "VALIDATION_ERROR", "preferredContact must be EMAIL or PHONE.");
    return;
  }
  if (body.requestType !== "QUOTE" && body.requestType !== "TEST_DRIVE") {
    sendApiError(res, 400, "VALIDATION_ERROR", "requestType must be QUOTE or TEST_DRIVE.");
    return;
  }

  const result = await createLead(
    {
      configurationPublicId: body.configurationPublicId,
      name: body.name.trim(),
      email: body.email.trim(),
      phone: typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null,
      preferredContact: body.preferredContact,
      message: typeof body.message === "string" && body.message.trim() ? body.message.trim() : null,
      requestType: body.requestType,
    },
    req.user?.id ?? null,
  );

  if (!result.ok) {
    sendApiError(res, 404, "CONFIGURATION_NOT_FOUND", "No configuration matches this ID.");
    return;
  }

  const responseBody: ApiResponse<LeadDto> = { data: result.lead };
  res.status(201).json(responseBody);
});
