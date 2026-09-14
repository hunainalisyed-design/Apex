import { Prisma } from "@prisma/client";
import { Router } from "express";
import { sendApiError } from "../lib/apiError.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { prisma } from "../lib/prisma.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { loginRateLimitByEmail, loginRateLimitByIp } from "../middleware/rateLimit.js";
import { sendPasswordResetEmail } from "../services/auth/email.js";
import { hashPassword, validatePasswordPolicy, verifyPassword } from "../services/auth/password.js";
import { consumeResetToken, createPasswordResetToken } from "../services/auth/passwordReset.js";
import {
  SESSION_COOKIE_NAME,
  clearSessionCookie,
  createSession,
  revokeSession,
  setSessionCookie,
} from "../services/auth/session.js";
import { mapUserToDto, normalizeEmail } from "../services/auth/user.js";
import type { ApiResponse } from "../types/api.js";
import type {
  ForgotPasswordRequest,
  LoginRequest,
  MessageResponseDto,
  ResetPasswordRequest,
  SignupRequest,
  UserDto,
} from "../types/auth.js";

export const authRouter = Router();

const GENERIC_FORGOT_PASSWORD_RESPONSE: MessageResponseDto = {
  message: "If an account exists for that email, we've sent a link to reset your password.",
};

authRouter.post(
  "/auth/signup",
  asyncHandler(async (req, res) => {
    const body = req.body as Partial<SignupRequest> | undefined;

    if (!body || typeof body.name !== "string" || !body.name.trim()) {
      sendApiError(res, 400, "VALIDATION_ERROR", "name is required.", { name: ["Name is required."] });
      return;
    }
    if (typeof body.email !== "string" || !body.email.trim()) {
      sendApiError(res, 400, "VALIDATION_ERROR", "email is required.", { email: ["Email is required."] });
      return;
    }
    if (typeof body.password !== "string") {
      sendApiError(res, 400, "VALIDATION_ERROR", "password is required.", { password: ["Password is required."] });
      return;
    }
    const passwordViolation = validatePasswordPolicy(body.password);
    if (passwordViolation) {
      sendApiError(res, 400, "VALIDATION_ERROR", passwordViolation, { password: [passwordViolation] });
      return;
    }
    if (body.acceptedTerms !== true) {
      sendApiError(res, 400, "VALIDATION_ERROR", "You must accept the terms to sign up.", {
        acceptedTerms: ["You must accept the terms to sign up."],
      });
      return;
    }

    const email = normalizeEmail(body.email);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      sendApiError(res, 409, "EMAIL_ALREADY_REGISTERED", "An account with this email already exists.", {
        email: ["An account with this email already exists."],
      });
      return;
    }

    const passwordHash = await hashPassword(body.password);

    try {
      const user = await prisma.user.create({
        data: { name: body.name.trim(), email, passwordHash, termsAcceptedAt: new Date() },
      });

      const token = await createSession(user.id);
      setSessionCookie(res, token);

      const responseBody: ApiResponse<UserDto> = { data: mapUserToDto(user) };
      res.status(201).json(responseBody);
    } catch (err) {
      const isEmailCollision =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002" &&
        (err.meta?.target as string[] | undefined)?.includes("email");
      if (isEmailCollision) {
        sendApiError(res, 409, "EMAIL_ALREADY_REGISTERED", "An account with this email already exists.", {
          email: ["An account with this email already exists."],
        });
        return;
      }
      throw err;
    }
  }),
);

authRouter.post(
  "/auth/login",
  loginRateLimitByIp,
  loginRateLimitByEmail,
  asyncHandler(async (req, res) => {
    const body = req.body as Partial<LoginRequest> | undefined;

    if (!body || typeof body.email !== "string" || typeof body.password !== "string") {
      sendApiError(res, 400, "VALIDATION_ERROR", "email and password are required.");
      return;
    }

    const email = normalizeEmail(body.email);
    const user = await prisma.user.findUnique({ where: { email } });

    // Same generic error whether the email doesn't exist or the password is wrong — never
    // reveal which one it was (Spec 16 §5).
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      sendApiError(res, 401, "INVALID_CREDENTIALS", "Incorrect email or password.");
      return;
    }

    const token = await createSession(user.id);
    setSessionCookie(res, token);

    const responseBody: ApiResponse<UserDto> = { data: mapUserToDto(user) };
    res.status(200).json(responseBody);
  }),
);

authRouter.post(
  "/auth/logout",
  requireAuth,
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[SESSION_COOKIE_NAME];
    if (typeof token === "string") {
      await revokeSession(token);
    }
    clearSessionCookie(res);
    res.status(204).end();
  }),
);

authRouter.get("/auth/me", optionalAuth, (req, res) => {
  const responseBody: ApiResponse<UserDto | null> = { data: req.user ?? null };
  res.status(200).json(responseBody);
});

authRouter.post(
  "/auth/forgot-password",
  asyncHandler(async (req, res) => {
    const body = req.body as Partial<ForgotPasswordRequest> | undefined;

    if (!body || typeof body.email !== "string" || !body.email.trim()) {
      sendApiError(res, 400, "VALIDATION_ERROR", "email is required.");
      return;
    }

    const email = normalizeEmail(body.email);
    const user = await prisma.user.findUnique({ where: { email } });

    // Response is byte-identical whether the account exists or not (AC-6) — the branch below
    // only ever affects side effects (mint a token, attempt a send), never what's returned.
    if (user) {
      const token = await createPasswordResetToken(user.id);
      const resetUrl = `${process.env.FRONTEND_ORIGIN ?? "http://localhost:3000"}/reset-password?token=${token}`;
      await sendPasswordResetEmail(user.email, resetUrl);
    }

    const responseBody: ApiResponse<MessageResponseDto> = { data: GENERIC_FORGOT_PASSWORD_RESPONSE };
    res.status(200).json(responseBody);
  }),
);

authRouter.post(
  "/auth/reset-password",
  asyncHandler(async (req, res) => {
    const body = req.body as Partial<ResetPasswordRequest> | undefined;

    if (!body || typeof body.token !== "string" || !body.token) {
      sendApiError(res, 400, "VALIDATION_ERROR", "token is required.");
      return;
    }
    if (typeof body.newPassword !== "string") {
      sendApiError(res, 400, "VALIDATION_ERROR", "newPassword is required.", {
        newPassword: ["Password is required."],
      });
      return;
    }
    const passwordViolation = validatePasswordPolicy(body.newPassword);
    if (passwordViolation) {
      sendApiError(res, 400, "VALIDATION_ERROR", passwordViolation, { newPassword: [passwordViolation] });
      return;
    }

    const result = await consumeResetToken(body.token, body.newPassword);
    if (!result.ok) {
      sendApiError(res, 400, "INVALID_OR_EXPIRED_TOKEN", "This reset link is invalid or has expired.");
      return;
    }

    const responseBody: ApiResponse<MessageResponseDto> = {
      data: { message: "Your password has been updated. Please log in again." },
    };
    res.status(200).json(responseBody);
  }),
);
