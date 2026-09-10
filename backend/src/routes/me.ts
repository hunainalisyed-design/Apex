import { Router } from "express";
import { sendApiError } from "../lib/apiError.js";
import { requireAuth } from "../middleware/auth.js";
import { changePassword, updateProfileName } from "../services/auth/user.js";
import { getConfigurationsForUser } from "../services/configurations.js";
import type { ApiResponse } from "../types/api.js";
import type { UserDto } from "../types/auth.js";
import type { SavedConfigurationDto } from "../types/configuration.js";
import type { ChangePasswordRequest, UpdateProfileRequest } from "../types/garage.js";

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

  const responseBody: ApiResponse<{ message: string }> = { data: { message: "Password updated." } };
  res.status(200).json(responseBody);
});
