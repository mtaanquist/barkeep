import rateLimit, { type RateLimitRequestHandler } from "express-rate-limit";

// Slows down password guessing on the sign-in routes. Only *failed* attempts
// count (`skipSuccessfulRequests`), so a whole party signing in for real over
// one shared connection is never turned away — only the guessing is.

const WINDOW_MS = 15 * 60 * 1000;

// Hosts are few people, so a tighter cap on wrong passwords is fine.
export const ADMIN_ATTEMPT_LIMIT = 10;
// A party of guests may all share one home connection, so theirs is looser.
export const GUEST_ATTEMPT_LIMIT = 30;

function limiter(max: number): RateLimitRequestHandler {
  return rateLimit({
    windowMs: WINDOW_MS,
    limit: max,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: "Too many attempts. Please wait a few minutes and try again.",
      });
    },
  });
}

/** For the bartender and operator sign-ins. */
export const adminLoginLimiter = (): RateLimitRequestHandler =>
  limiter(ADMIN_ATTEMPT_LIMIT);

/** For the guest sign-ins, which a crowd may all come through at once. */
export const guestLoginLimiter = (): RateLimitRequestHandler =>
  limiter(GUEST_ATTEMPT_LIMIT);
