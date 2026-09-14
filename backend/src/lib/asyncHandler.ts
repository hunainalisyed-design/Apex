import type { NextFunction, Request, RequestHandler, Response } from "express";

/** Express 4 does not forward a rejected promise from an async handler to error-handling
 * middleware — it becomes an unhandled rejection and can crash the process (e.g. a Prisma
 * call failing because the database is unreachable). Wrap async handlers/middleware with
 * this so failures reach the global error handler in app.ts as a clean 500 instead. */
export function asyncHandler<Req extends Request = Request>(
  handler: (req: Req, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    handler(req as Req, res, next).catch(next);
  };
}
