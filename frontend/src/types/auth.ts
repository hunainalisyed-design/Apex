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

export interface UserDto {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface MessageResponseDto {
  message: string;
}
