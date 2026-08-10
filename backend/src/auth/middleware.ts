import type { NextFunction, Request, Response } from "express";

import { HttpError } from "../http.js";
import {
  readSessionCookie,
  verifySession,
  type Session,
} from "./session.js";
import { readOperatorCookie, verifyOperator } from "./operator.js";

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
      ...(payload.authenticated ? { authenticated: true } : {}),
    } satisfies Session;
  }

  next();
}

/** The session on this reply, if the cookie checked out. */
export function currentSession(res: Response): Session | undefined {
  return res.locals["session"] as Session | undefined;
}

/** Whoever the cookie names, of either kind. Throws if there's no session. */
export function requireSession(res: Response): Session {
  const session = currentSession(res);
  if (!session) throw HttpError.unauthorized("Please sign in");
  return session;
}

/**
 * A bartender, and the bar they're signed in to. The bar comes from the cookie,
 * so a request can't act on a bar it wasn't signed in to by naming another one.
 */
export function requireBartender(res: Response): { barId: number } {
  const session = requireSession(res);
  if (session.role !== "bartender") {
    throw HttpError.forbidden("Only the bartender can do this");
  }
  return { barId: session.barId };
}

/** A guest, their bar, and their name — both taken from the cookie. */
export function requireGuest(res: Response): { barId: number; name: string } {
  const session = requireSession(res);
  if (session.role !== "guest" || !session.name) {
    throw HttpError.forbidden("Only a guest can do this");
  }
  return { barId: session.barId, name: session.name };
}

/**
 * A regular: a guest who proved a password for their name. For the few things
 * only a claimed name should do — changing its own password. A one-time guest,
 * whose name nobody has claimed, is turned away.
 */
export function requireRegular(res: Response): { barId: number; name: string } {
  const session = requireSession(res);
  if (session.role !== "guest" || !session.name || session.authenticated !== true) {
    throw HttpError.forbidden("Only a signed-in regular can do this");
  }
  return { barId: session.barId, name: session.name };
}

/**
 * A bartender signed in to the bar named in the address. The address carries a
 * bar id, so this checks the cookie is for that same bar — a valid sign-in to
 * one bar can't read another's orders or takings.
 */
export function requireBartenderForBar(res: Response, barId: number): void {
  const session = requireBartender(res);
  if (session.barId !== barId) {
    throw HttpError.forbidden("You can only see your own bar");
  }
}

/**
 * Anyone signed in to the bar named in the address — guest or bartender. For
 * the shared reads (the menu, the order queue) that both kinds need.
 */
export function requireBarMember(res: Response, barId: number): Session {
  const session = requireSession(res);
  if (session.barId !== barId) {
    throw HttpError.forbidden("You can only see your own bar");
  }
  return session;
}

/**
 * The operator, from their own cookie. Separate from the bar session, so this
 * reads that cookie directly rather than anything `attachSession` left behind.
 */
export function requireOperator(req: Request): void {
  const token = readOperatorCookie(req);
  if (!token || !verifyOperator(token)) {
    throw HttpError.unauthorized("Please sign in");
  }
}
