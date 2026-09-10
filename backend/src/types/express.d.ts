import type { UserDto } from "./auth.js";

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth/optionalAuth (Spec 16) from the session cookie. */
      user?: UserDto;
    }
  }
}

export {};
