import type {
  ForgotPasswordRequest,
  LoginRequest,
  MessageResponseDto,
  ResetPasswordRequest,
  SignupRequest,
  UserDto,
} from "@/types/auth";
import { ApiRequestError } from "./configurations";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

/** Every auth call needs credentials: "include" (Spec 16) — none of this app's other API
 * client functions are cookie-based, so this is the first place that matters. Without it,
 * the browser won't send or store the httpOnly session cookie across the frontend/backend
 * origins even though the backend's CORS config allows it. */
async function authFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}/api/auth/${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  if (res.status === 204) return undefined as T;

  const json = await res.json();
  if (!res.ok) {
    throw new ApiRequestError(json.code ?? "UNKNOWN_ERROR", json.message ?? "Something went wrong.", json.details);
  }
  return json.data as T;
}

export function signup(request: SignupRequest): Promise<UserDto> {
  return authFetch("signup", { method: "POST", body: JSON.stringify(request) });
}

export function login(request: LoginRequest): Promise<UserDto> {
  return authFetch("login", { method: "POST", body: JSON.stringify(request) });
}

export function logout(): Promise<void> {
  return authFetch("logout", { method: "POST" });
}

export function getMe(): Promise<UserDto | null> {
  return authFetch("me", { method: "GET" });
}

export function forgotPassword(request: ForgotPasswordRequest): Promise<MessageResponseDto> {
  return authFetch("forgot-password", { method: "POST", body: JSON.stringify(request) });
}

export function resetPassword(request: ResetPasswordRequest): Promise<MessageResponseDto> {
  return authFetch("reset-password", { method: "POST", body: JSON.stringify(request) });
}
