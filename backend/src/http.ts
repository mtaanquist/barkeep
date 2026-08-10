import type { NextFunction, Request, RequestHandler, Response } from "express";

/** An error meant for the person using the app, with a status to send. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /**
     * A short machine-readable tag the pages can branch on, when the same
     * status means different things (a claimed name vs. a wrong password).
     */
    readonly code?: string
  ) {
    super(message);
    this.name = "HttpError";
  }

  static badRequest(message: string): HttpError {
    return new HttpError(400, message);
  }

  static notFound(message: string): HttpError {
    return new HttpError(404, message);
  }

  static conflict(message: string): HttpError {
    return new HttpError(409, message);
  }

  /** Not signed in — no cookie, or one that no longer holds up. */
  static unauthorized(message: string): HttpError {
    return new HttpError(401, message);
  }

  /** Signed in, but not as someone allowed to do this. */
  static forbidden(message: string): HttpError {
    return new HttpError(403, message);
  }
}

/**
 * Wraps a handler so a thrown error becomes a reply instead of a hung
 * request. Saves every route repeating the same try/catch.
 */
export function route(
  handler: (req: Request, res: Response) => unknown | Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}

/** Reads a whole number from the address, e.g. /bar/:barId. */
export function idParam(req: Request, name: string): number {
  const value = Number(req.params[name]);

  if (!Number.isInteger(value) || value <= 0) {
    throw HttpError.badRequest(`Invalid ${name}`);
  }

  return value;
}

/** Reads a whole number sent in the body, rejecting anything else. */
export function requireId(body: unknown, field: string): number {
  const value = Number((body as Record<string, unknown>)?.[field]);

  if (!Number.isInteger(value) || value <= 0) {
    throw HttpError.badRequest(`${field} is required`);
  }

  return value;
}

/** Reads text that has to be there and not be blank. */
export function requireText(
  body: unknown,
  field: string,
  { min = 1, label = field }: { min?: number; label?: string } = {}
): string {
  const raw = (body as Record<string, unknown>)?.[field];

  if (typeof raw !== "string" || raw.trim().length < min) {
    throw HttpError.badRequest(
      min > 1
        ? `${label} must be at least ${min} characters long`
        : `${label} is required`
    );
  }

  return raw.trim();
}

/** Reads text that may be left out entirely. */
export function optionalText(body: unknown, field: string): string | undefined {
  const raw = (body as Record<string, unknown>)?.[field];
  return typeof raw === "string" ? raw.trim() : undefined;
}

/** True when a field was sent at all, so partial updates can tell. */
export function wasSent(body: unknown, field: string): boolean {
  return (
    typeof body === "object" &&
    body !== null &&
    field in (body as Record<string, unknown>)
  );
}

/** Turns whatever was sent into the 0 or 1 SQLite stores. */
export function toFlag(value: unknown): 0 | 1 {
  return value ? 1 : 0;
}

/** Sends the right reply for anything a route threw. */
export function errorReply(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof HttpError) {
    res
      .status(err.status)
      .json(err.code ? { error: err.message, code: err.code } : { error: err.message });
    return;
  }

  const asRecord = err as { code?: string; message?: string; status?: number };

  if (asRecord?.code === "LIMIT_FILE_SIZE") {
    res.status(400).json({ error: "File too large. Maximum size is 5MB." });
    return;
  }

  if (asRecord?.message === "Only image files are allowed!") {
    res.status(400).json({ error: "Only image files are allowed." });
    return;
  }

  if (asRecord?.status === 404) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  // A request body over the size cap, from the JSON/form parser.
  if (asRecord?.status === 413) {
    res.status(413).json({ error: "Request body too large." });
    return;
  }

  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "Internal server error",
    message:
      process.env.NODE_ENV === "development"
        ? asRecord?.message
        : "Something went wrong",
  });
}
