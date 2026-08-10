import type { NextFunction, Request, Response } from "express";

import {
  readSessionCookie,
  verifySession,
  type Session,
} from "./session.js";

/**
 * Resolves the cookie to a session and leaves it on `res.locals` for routes to
 * read. It never turns anyone away — each route decides what it needs. Runs
 * before the routes so the live feed sees it too.
 */
export function attachSession(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = readSessionCookie(req);
  const payload = token ? verifySession(token) : null;

  if (payload) {
    res.locals["session"] = {
      barId: payload.barId,
      role: payload.role,
      ...(payload.name !== undefined ? { name: payload.name } : {}),
    } satisfies Session;
  }

  next();
}

/** The session on this reply, if the cookie checked out. */
export function currentSession(res: Response): Session | undefined {
  return res.locals["session"] as Session | undefined;
}
