export interface SignupRequest {
  name: string;
  email: string;
  password: string;
  acceptedTerms: true;
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

export interface MessageResponseDto {
  message: string;
}
