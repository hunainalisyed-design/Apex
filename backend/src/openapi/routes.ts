/**
 * Every public endpoint the OpenAPI document describes (Spec 26, AC-3). Request/response
 * shapes are type *names* resolved against schemas.generated.json (generated from
 * src/types/), so a DTO change flows into the docs by regenerating — nothing here restates a
 * shape. tests/integration/openapi.int.test.ts fails if a mounted route is missing from this
 * list without being in UNDOCUMENTED_ROUTES, or if a referenced type doesn't exist.
 */

export type HttpMethod = "get" | "post" | "put" | "delete";

export interface RouteDoc {
  method: HttpMethod;
  /** Express-style path relative to /api, e.g. "/vehicles/:slug". */
  path: string;
  tag: string;
  summary: string;
  /** "optional": a session cookie changes the result but isn't required. */
  auth: "none" | "optional" | "required";
  requestBody?: string;
  /** A raw binary request body of this media type, instead of a JSON `requestBody`. */
  binaryRequestBody?: string;
  success: {
    status: number;
    description: string;
    /** Omit for an empty body (e.g. 204). */
    schema?: string;
    /** A raw binary response of this media type, instead of a JSON `schema`. */
    binaryContentType?: string;
    array?: boolean;
    nullable?: boolean;
    /** false = the body is the schema itself, not wrapped in `{ data }`. Default true. */
    envelope?: boolean;
  };
  /** status → the stable ApiError codes that status can carry. */
  errors?: Record<number, string[]>;
}

/** Mounted routes intentionally left out of the public docs, with the reason. */
export const UNDOCUMENTED_ROUTES: Array<{ method: HttpMethod; path: string; reason: string }> = [
  { method: "post", path: "/reservations/webhook", reason: "Stripe server-to-server webhook, not a client API." },
  { method: "get", path: "/admin/vehicles", reason: "Internal admin API (Spec 21)." },
  { method: "post", path: "/admin/vehicles", reason: "Internal admin API (Spec 21)." },
  { method: "put", path: "/admin/vehicles/:id", reason: "Internal admin API (Spec 21)." },
  { method: "get", path: "/admin/vehicles/:id/options", reason: "Internal admin API (Spec 21)." },
  { method: "post", path: "/admin/vehicles/:id/options", reason: "Internal admin API (Spec 21)." },
  { method: "put", path: "/admin/options/:id", reason: "Internal admin API (Spec 21)." },
  { method: "delete", path: "/admin/options/:id", reason: "Internal admin API (Spec 21)." },
  { method: "get", path: "/admin/leads", reason: "Internal admin API (Spec 21)." },
  { method: "put", path: "/admin/leads/:id", reason: "Internal admin API (Spec 21)." },
  { method: "get", path: "/admin/reservations", reason: "Internal admin API (Spec 21)." },
  { method: "get", path: "/docs", reason: "This document itself." },
];

const UNAUTHENTICATED = { 401: ["UNAUTHENTICATED"] };
const PRICING_ERRORS = { 400: ["VALIDATION_ERROR"], 404: ["VEHICLE_NOT_FOUND"], 422: ["OPTION_VEHICLE_MISMATCH", "DUPLICATE_OPTION_SELECTION"] };

export const DOCUMENTED_ROUTES: RouteDoc[] = [
  // --- Health ---------------------------------------------------------------------------
  {
    method: "get",
    path: "/health",
    tag: "Health",
    summary: "Service and database health",
    auth: "none",
    success: { status: 200, description: "Healthy. Returns 503 with the same body when degraded.", schema: "HealthResponse", envelope: false },
  },

  // --- Catalog (Spec 2) -----------------------------------------------------------------
  {
    method: "get",
    path: "/vehicles",
    tag: "Catalog",
    summary: "List active vehicles",
    auth: "none",
    success: { status: 200, description: "Active vehicles.", schema: "VehicleSummaryDto", array: true },
  },
  {
    method: "get",
    path: "/vehicles/:slug",
    tag: "Catalog",
    summary: "One vehicle with its options grouped by category",
    auth: "none",
    success: { status: 200, description: "The vehicle.", schema: "VehicleDetailDto" },
    errors: { 404: ["VEHICLE_NOT_FOUND"] },
  },
  {
    method: "get",
    path: "/vehicles/:slug/options",
    tag: "Catalog",
    summary: "A vehicle's active customization options",
    auth: "none",
    success: { status: 200, description: "The options.", schema: "CustomizationOptionDto", array: true },
    errors: { 404: ["VEHICLE_NOT_FOUND"] },
  },

  // --- Environments (Spec 28) -----------------------------------------------------------
  {
    method: "get",
    path: "/environments",
    tag: "Catalog",
    summary: "Showroom environments (scene presets) available to every vehicle",
    auth: "none",
    success: { status: 200, description: "The environments, in switcher order.", schema: "EnvironmentDto", array: true },
  },

  // --- Pricing (Spec 3) -----------------------------------------------------------------
  {
    method: "post",
    path: "/pricing/calculate",
    tag: "Pricing",
    summary: "Authoritative price breakdown for a set of selections",
    auth: "none",
    requestBody: "PriceCalculationRequest",
    success: { status: 200, description: "The price breakdown.", schema: "PriceBreakdownDto" },
    errors: PRICING_ERRORS,
  },

  // --- Configurations (Specs 10, 17) ----------------------------------------------------
  {
    method: "post",
    path: "/configurations",
    tag: "Configurations",
    summary: "Save a build and get its shareable publicId",
    auth: "optional",
    requestBody: "SaveConfigurationRequest",
    success: { status: 201, description: "The saved build (owned by the caller when signed in).", schema: "SavedConfigurationDto" },
    errors: { ...PRICING_ERRORS, 429: ["RATE_LIMITED"] },
  },
  {
    method: "get",
    path: "/configurations/:publicId",
    tag: "Configurations",
    summary: "Load a saved build",
    auth: "none",
    success: { status: 200, description: "The saved build.", schema: "SavedConfigurationDto" },
    errors: { 404: ["CONFIGURATION_NOT_FOUND"] },
  },
  {
    method: "delete",
    path: "/configurations/:publicId",
    tag: "Configurations",
    summary: "Delete one of your saved builds",
    auth: "required",
    success: { status: 204, description: "Deleted." },
    errors: { ...UNAUTHENTICATED, 404: ["CONFIGURATION_NOT_FOUND"], 409: ["CONFIGURATION_IN_USE"] },
  },
  {
    method: "post",
    path: "/configurations/:publicId/claim",
    tag: "Configurations",
    summary: "Claim a guest build into your account",
    auth: "required",
    success: { status: 200, description: "The claimed build.", schema: "SavedConfigurationDto" },
    errors: { ...UNAUTHENTICATED, 404: ["CONFIGURATION_NOT_FOUND"], 409: ["ALREADY_CLAIMED"] },
  },

  // --- CarAI (Spec 14) ------------------------------------------------------------------
  {
    method: "post",
    path: "/ai/configure",
    tag: "CarAI",
    summary: "Ask CarAI for a catalog-valid configuration recommendation",
    auth: "none",
    requestBody: "AiConfigureRequest",
    success: { status: 200, description: "The recommendation.", schema: "AiConfigureResponseDto" },
    errors: {
      400: ["VALIDATION_ERROR"],
      404: ["VEHICLE_NOT_FOUND"],
      429: ["RATE_LIMITED"],
      502: ["AI_PROVIDER_ERROR"],
      503: ["AI_ASSISTANT_DISABLED"],
    },
  },

  // --- Auth (Spec 16) -------------------------------------------------------------------
  {
    method: "post",
    path: "/auth/signup",
    tag: "Auth",
    summary: "Create an account and start a session",
    auth: "none",
    requestBody: "SignupRequest",
    success: { status: 201, description: "The new user; sets the session cookie.", schema: "UserDto" },
    errors: { 400: ["VALIDATION_ERROR"], 409: ["EMAIL_ALREADY_REGISTERED"] },
  },
  {
    method: "post",
    path: "/auth/login",
    tag: "Auth",
    summary: "Sign in",
    auth: "none",
    requestBody: "LoginRequest",
    success: { status: 200, description: "The user; sets the session cookie.", schema: "UserDto" },
    errors: { 400: ["VALIDATION_ERROR"], 401: ["INVALID_CREDENTIALS"], 429: ["TOO_MANY_ATTEMPTS"] },
  },
  {
    method: "post",
    path: "/auth/logout",
    tag: "Auth",
    summary: "Sign out",
    auth: "required",
    success: { status: 204, description: "Signed out; clears the session cookie." },
    errors: UNAUTHENTICATED,
  },
  {
    method: "get",
    path: "/auth/me",
    tag: "Auth",
    summary: "The signed-in user, or null",
    auth: "optional",
    success: { status: 200, description: "The current user, or null when signed out.", schema: "UserDto", nullable: true },
  },
  {
    method: "post",
    path: "/auth/forgot-password",
    tag: "Auth",
    summary: "Request a password-reset email",
    auth: "none",
    requestBody: "ForgotPasswordRequest",
    success: { status: 200, description: "Always the same generic message, whether or not the email exists.", schema: "MessageResponseDto" },
    errors: { 400: ["VALIDATION_ERROR"] },
  },
  {
    method: "post",
    path: "/auth/reset-password",
    tag: "Auth",
    summary: "Set a new password with a reset token",
    auth: "none",
    requestBody: "ResetPasswordRequest",
    success: { status: 200, description: "Password reset.", schema: "MessageResponseDto" },
    errors: { 400: ["VALIDATION_ERROR", "INVALID_OR_EXPIRED_TOKEN"] },
  },

  // --- Account (Specs 17, 24) -----------------------------------------------------------
  {
    method: "get",
    path: "/me/configurations",
    tag: "Account",
    summary: "Your saved builds (My Garage)",
    auth: "required",
    success: { status: 200, description: "Your builds.", schema: "SavedConfigurationDto", array: true },
    errors: UNAUTHENTICATED,
  },
  {
    method: "put",
    path: "/me/profile",
    tag: "Account",
    summary: "Update your display name",
    auth: "required",
    requestBody: "UpdateProfileRequest",
    success: { status: 200, description: "The updated user.", schema: "UserDto" },
    errors: { 400: ["VALIDATION_ERROR"], ...UNAUTHENTICATED },
  },
  {
    method: "put",
    path: "/me/password",
    tag: "Account",
    summary: "Change your password",
    auth: "required",
    requestBody: "ChangePasswordRequest",
    success: { status: 200, description: "Password updated.", schema: "MessageResponseDto" },
    errors: { 400: ["VALIDATION_ERROR"], 401: ["UNAUTHENTICATED", "INVALID_CREDENTIALS"] },
  },
  {
    method: "get",
    path: "/me/export",
    tag: "Account",
    summary: "Export all your personal data (GDPR)",
    auth: "required",
    success: { status: 200, description: "Everything stored about you, as a downloadable JSON file.", schema: "UserDataExportDto", envelope: false },
    errors: UNAUTHENTICATED,
  },
  {
    method: "delete",
    path: "/me",
    tag: "Account",
    summary: "Delete your account (GDPR)",
    auth: "required",
    requestBody: "DeleteAccountRequest",
    success: { status: 204, description: "Account deleted; clears the session cookie." },
    errors: { 400: ["VALIDATION_ERROR"], ...UNAUTHENTICATED, 409: ["ADMIN_ACCOUNT_CANNOT_SELF_DELETE"] },
  },

  // --- Leads (Spec 19) ------------------------------------------------------------------
  {
    method: "post",
    path: "/leads",
    tag: "Leads",
    summary: "Request a quote or test drive for a saved build",
    auth: "optional",
    requestBody: "CreateLeadRequest",
    success: { status: 201, description: "The lead.", schema: "LeadDto" },
    errors: { 400: ["VALIDATION_ERROR"], 404: ["CONFIGURATION_NOT_FOUND"], 429: ["RATE_LIMITED"] },
  },

  // --- AR (Spec 27) ---------------------------------------------------------------------
  {
    method: "post",
    path: "/ar/models",
    tag: "AR",
    summary: "Host an exported AR model briefly for Android Scene Viewer",
    auth: "none",
    binaryRequestBody: "model/gltf-binary",
    success: { status: 201, description: "Where Scene Viewer can download the model, and when that URL expires.", schema: "ArModelUploadDto" },
    errors: {
      400: ["VALIDATION_ERROR"],
      413: ["AR_MODEL_TOO_LARGE"],
      429: ["RATE_LIMITED"],
      503: ["AR_DISABLED"],
    },
  },
  {
    method: "get",
    path: "/ar/models/:id.glb",
    tag: "AR",
    summary: "Download a hosted AR model (expires 10 minutes after upload)",
    auth: "none",
    success: { status: 200, description: "The GLB file.", binaryContentType: "model/gltf-binary" },
    errors: { 404: ["AR_MODEL_NOT_FOUND"], 503: ["AR_DISABLED"] },
  },

  // --- Reservations (Spec 20, Stripe test mode) -----------------------------------------
  {
    method: "post",
    path: "/reservations/checkout-session",
    tag: "Reservations",
    summary: "Start a test-mode Stripe checkout for a reservation deposit",
    auth: "optional",
    requestBody: "CreateCheckoutSessionRequest",
    success: { status: 200, description: "The Stripe-hosted checkout URL to redirect to.", schema: "CheckoutSessionDto" },
    errors: {
      400: ["VALIDATION_ERROR"],
      404: ["CONFIGURATION_NOT_FOUND"],
      429: ["RATE_LIMITED"],
      502: ["PAYMENT_PROVIDER_ERROR"],
      503: ["RESERVATIONS_DISABLED"],
    },
  },
  {
    method: "get",
    path: "/reservations/:id",
    tag: "Reservations",
    summary: "A reservation's status",
    auth: "none",
    success: { status: 200, description: "The reservation.", schema: "ReservationDto" },
    errors: { 404: ["RESERVATION_NOT_FOUND"] },
  },
];
