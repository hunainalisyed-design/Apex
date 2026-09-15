export interface SignupRequest {
  name: string;
  email: string;
  password: string;
  acceptedTerms: true; // must be explicitly true; the API rejects anything else
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export type UserRole = "USER" | "ADMIN";

export interface UserDto {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

/** Shared response shape for forgot-password and reset-password — both are deliberately
 * generic (no per-account detail leaked; see AC-6's no-enumeration guarantee). */
export interface MessageResponseDto {
  message: string;
}
