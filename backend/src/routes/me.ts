import { Router } from "express";
import { sendApiError } from "../lib/apiError.js";
import { requireAuth } from "../middleware/auth.js";
import { clearSessionCookie } from "../services/auth/session.js";
import { changePassword, updateProfileName } from "../services/auth/user.js";
import { getConfigurationsForUser } from "../services/configurations.js";
import { deleteAccount, exportUserData } from "../services/gdpr.js";
import type { ApiResponse } from "../types/api.js";
import type { MessageResponseDto, UserDto } from "../types/auth.js";
import type { SavedConfigurationDto } from "../types/configuration.js";
import type { ChangePasswordRequest, UpdateProfileRequest } from "../types/garage.js";
import type { DeleteAccountRequest } from "../types/gdpr.js";

export const meRouter = Router();

meRouter.get("/me/configurations", requireAuth, async (req, res) => {
  const configurations = await getConfigurationsForUser(req.user!.id);

  const responseBody: ApiResponse<SavedConfigurationDto[]> = { data: configurations };
  res.status(200).json(responseBody);
});

meRouter.put("/me/profile", requireAuth, async (req, res) => {
  const body = req.body as Partial<UpdateProfileRequest> | undefined;

  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    sendApiError(res, 400, "VALIDATION_ERROR", "name is required.", { name: ["Name is required."] });
    return;
  }

  const user = await updateProfileName(req.user!.id, body.name.trim());

  const responseBody: ApiResponse<UserDto> = { data: user };
  res.status(200).json(responseBody);
});

meRouter.put("/me/password", requireAuth, async (req, res) => {
  const body = req.body as Partial<ChangePasswordRequest> | undefined;

  if (!body || typeof body.currentPassword !== "string" || typeof body.newPassword !== "string") {
    sendApiError(res, 400, "VALIDATION_ERROR", "currentPassword and newPassword are required.");
    return;
  }

  const result = await changePassword(req.user!.id, body.currentPassword, body.newPassword, req.sessionToken!);

  if (!result.ok) {
    if (result.reason === "INVALID_CURRENT_PASSWORD") {
      sendApiError(res, 401, "INVALID_CREDENTIALS", "Current password is incorrect.", {
        currentPassword: ["Current password is incorrect."],
      });
      return;
    }
    sendApiError(res, 400, "VALIDATION_ERROR", result.message, { newPassword: [result.message] });
    return;
  }

  const responseBody: ApiResponse<MessageResponseDto> = { data: { message: "Password updated." } };
  res.status(200).json(responseBody);
});

/** Spec 24, AC-5 — a raw file download, not the usual `{ data }` envelope: this response's
 * only consumer is the browser saving it, not frontend JS unpacking an ApiResponse. */
meRouter.get("/me/export", requireAuth, async (req, res) => {
  const data = await exportUserData(req.user!.id);

  res.setHeader("Content-Disposition", `attachment; filename="apex-my-data-${req.user!.id}.json"`);
  res.status(200).json(data);
});

meRouter.delete("/me", requireAuth, async (req, res) => {
  const body = req.body as Partial<Record<keyof DeleteAccountRequest, unknown>> | undefined;

  if (!body || typeof body.confirmEmail !== "string" || !body.confirmEmail.trim()) {
    sendApiError(res, 400, "VALIDATION_ERROR", "confirmEmail is required.", {
      confirmEmail: ["Type your account email to confirm."],
    });
    return;
  }

  const result = await deleteAccount(req.user!.id, body.confirmEmail);

  if (!result.ok) {
    if (result.reason === "ADMIN_ACCOUNT") {
      sendApiError(res, 409, "ADMIN_ACCOUNT_CANNOT_SELF_DELETE", "Admin accounts can't be deleted this way.");
      return;
    }
    sendApiError(res, 400, "VALIDATION_ERROR", "That doesn't match your account email.", {
      confirmEmail: ["That doesn't match your account email."],
    });
    return;
  }

  clearSessionCookie(res);
  res.status(204).end();
});
