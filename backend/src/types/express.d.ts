import type { UserDto } from "./auth.js";

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth/optionalAuth (Spec 16) from the session cookie. */
      user?: UserDto;
      /** The raw session cookie value, set by requireAuth alongside `user` (Spec 17) — lets
       * a route identify its own session to exclude it from a bulk revocation (AC-9's
       * "keep the current session signed in" password-change requirement). */
      sessionToken?: string;
    }
  }
}

export {};
