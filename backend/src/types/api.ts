export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  code: string; // SCREAMING_SNAKE_CASE, stable forever once shipped
  message: string;
  details?: Record<string, string[]>;
}
