import express, {
  type Request,
  type Response,
  type Router,
} from "express";
import bcrypt from "bcrypt";
import QRCode from "qrcode";
import { randomBytes } from "node:crypto";

import type {
  Bar,
  BarQrCode,
  Language,
  Order,
  SignedIn,
} from "../../../shared/types.js";
import {
  HttpError,
  idParam,
  optionalText,
  requireText,
  route,
  toFlag,
  wasSent,
} from "../http.js";
import { HASH_ROUNDS } from "../config.js";
import { setSessionCookie } from "../auth/session.js";
import {
  listRegulars,
  renameRegular,
  resolveGuest,
  setRegularPassword,
} from "../auth/guestAccounts.js";
import {
  requireBartender,
  requireBartenderForBar,
} from "../auth/middleware.js";
import {
  all,
  buildUpdate,
  count,
  findBar,
  one,
  publicBar,
  run,
  type BarRow,
  type Db,
} from "../db/queries.js";
import { AVAILABLE } from "../db/drinkIngredients.js";

const LANGUAGES: readonly Language[] = ["en", "da"];

const PASSWORD_RULES = {
  bartender: { min: 4, label: "Bartender password" },
  guest: { min: 3, label: "Guest password" },
} as const;

/** The bar fields that are safe to list. Never the token or the hashes. */
const PUBLIC_COLUMNS =
  "id, name, language, skip_approval, orders_closed, max_active_orders, last_orders_at, created_at";

/** One at a time is the point of the rule; a hundred is somebody's typo. */
function requireOrderLimit(value: unknown): number {
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 10) {
    throw HttpError.badRequest(
      "Orders at a time must be a whole number from 1 to 10"
    );
  }
  return limit;
}

/** A moment to stop taking orders, or nothing to leave it to the switch. */
function requireMoment(value: unknown): string | null {
  if (value === null || value === "") return null;

  const when = new Date(String(value));
  if (Number.isNaN(when.getTime())) {
    throw HttpError.badRequest("Last orders is not a time");
  }
  return when.toISOString();
}

function requireLanguage(value: unknown): Language {
  if (!LANGUAGES.includes(value as Language)) {
    throw HttpError.badRequest("Invalid language. Supported: en, da");
  }
  return value as Language;
}

/**
 * The link every bar started with. Kept so codes printed before the token
 * could be rotated still work, right up until someone rotates it.
 */
function originalToken(barId: number): string {
  return Buffer.from(`${barId}:guest_access`).toString("base64");
}

/** What this bar's QR code carries today. */
function guestToken(bar: BarRow): string {
  return bar.guest_token || originalToken(bar.id);
}

/**
 * The bar the signed-in bartender may change: their own. The bar comes from
 * the cookie, and the address has to name the same one, so a valid sign-in for
 * one bar can't reach another.
 */
function ownBar(req: Request, res: Response): number {
  const { barId } = requireBartender(res);
  if (idParam(req, "id") !== barId) {
    throw HttpError.forbidden("You can only change your own bar");
  }
  return barId;
}

interface BarRoutesOptions {
  db: Db;
  publicUrl?: string;
}

export default function createBarRoutes({
  db,
  publicUrl = "",
}: BarRoutesOptions): Router {
  const router = express.Router();

  router.post(
    "/",
    route(async (req, res) => {
      const name = requireText(req.body, "name", {
        min: 2,
        label: "Bar name",
      });
      const bartenderPassword = requireText(req.body, "bartenderPassword", {
        ...PASSWORD_RULES.bartender,
      });
      const guestPassword = requireText(req.body, "guestPassword", {
        ...PASSWORD_RULES.guest,
      });
      const language = wasSent(req.body, "language")
        ? requireLanguage((req.body as Record<string, unknown>)["language"])
        : "en";

      // A retired bar frees its name; only a live one can clash.
      const taken = one<Pick<Bar, "id">>(
        db,
        "SELECT id FROM bars WHERE name = ? AND deleted_at IS NULL",
        name
      );

      if (taken) {
        throw HttpError.conflict("A bar with this name already exists");
      }

      const [bartenderHash, guestHash] = await Promise.all([
        bcrypt.hash(bartenderPassword, HASH_ROUNDS),
        bcrypt.hash(guestPassword, HASH_ROUNDS),
      ]);

      const { lastInsertRowid } = run(
        db,
        `INSERT INTO bars (name, bartender_password_hash, guest_password_hash, language, created_at)
         VALUES (?, ?, ?, ?, datetime('now'))`,
        name,
        bartenderHash,
        guestHash,
        language
      );

      const bar = findBar(db, Number(lastInsertRowid));
      // Making a bar signs you in as its bartender, so there's no unguarded
      // gap between creating it and being able to run it.
      setSessionCookie(res, { barId: bar.id, role: "bartender" });

      // The whole bar goes back, settings and all, so the pages can hold on to
      // it as-is.
      res.status(201).json(publicBar(bar));
    })
  );

  router.get(
    "/",
    route((req, res) => {
      const limit = Math.min(Number(req.query["limit"] ?? 50) || 50, 200);

      res.json(
        all<Bar>(
          db,
          `SELECT ${PUBLIC_COLUMNS} FROM bars
           WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT ?`,
          limit
        )
      );
    })
  );

  router.get(
    "/:id",
    route((req, res) => {
      res.json(publicBar(findBar(db, idParam(req, "id"))));
    })
  );

  router.put(
    "/:id",
    route(async (req, res) => {
      const barId = ownBar(req, res);
      findBar(db, barId);

      const body = req.body as Record<string, unknown>;

      const changes: Record<string, unknown> = {
        name: wasSent(body, "name")
          ? requireText(body, "name", { min: 2, label: "Bar name" })
          : undefined,
        language: wasSent(body, "language")
          ? requireLanguage(body["language"])
          : undefined,
        skip_approval: wasSent(body, "skipApproval")
          ? toFlag(body["skipApproval"])
          : undefined,
        orders_closed: wasSent(body, "ordersClosed")
          ? toFlag(body["ordersClosed"])
          : undefined,
        max_active_orders: wasSent(body, "maxActiveOrders")
          ? requireOrderLimit(body["maxActiveOrders"])
          : undefined,
        last_orders_at: wasSent(body, "lastOrdersAt")
          ? requireMoment(body["lastOrdersAt"])
          : undefined,
      };

      for (const [field, column] of [
        ["newBartenderPassword", "bartender_password_hash"],
        ["newGuestPassword", "guest_password_hash"],
      ] as const) {
        if (!wasSent(body, field)) continue;

        const rules =
          field === "newBartenderPassword"
            ? PASSWORD_RULES.bartender
            : PASSWORD_RULES.guest;

        changes[column] = await bcrypt.hash(
          requireText(body, field, { ...rules }),
          HASH_ROUNDS
        );
      }

      const { clause, values } = buildUpdate(changes);

      run(db, `UPDATE bars SET ${clause} WHERE id = ?`, ...values, barId);

      res.json(
        one<Bar>(
          db,
          `SELECT ${PUBLIC_COLUMNS} FROM bars WHERE id = ?`,
          barId
        )
      );
    })
  );

  router.get(
    "/:id/dashboard",
    route((req, res) => {
      const barId = idParam(req, "id");
      requireBartenderForBar(res, barId);
      const bar = publicBar(findBar(db, barId));

      res.json({
        bar,
        stats: {
          totalDrinks: count(
            db,
            "SELECT COUNT(*) AS n FROM drinks WHERE bar_id = ?",
            barId
          ),
          inStockDrinks: count(
            db,
            `SELECT COUNT(*) AS n FROM (
               SELECT ${AVAILABLE} FROM drinks d WHERE d.bar_id = ?
             ) WHERE available = 1`,
            barId
          ),
          totalOrders: count(
            db,
            "SELECT COUNT(*) AS n FROM orders WHERE bar_id = ?",
            barId
          ),
          pendingOrders: count(
            db,
            `SELECT COUNT(*) AS n FROM orders
             WHERE bar_id = ? AND status IN ('new', 'accepted', 'ready')`,
            barId
          ),
          todayOrders: count(
            db,
            `SELECT COUNT(*) AS n FROM orders
             WHERE bar_id = ? AND date(created_at) = date('now')`,
            barId
          ),
        },
        recentOrders: all<
          Pick<Order, "customer_name" | "drink_title" | "status" | "created_at">
        >(
          db,
          `SELECT customer_name, drink_title, status, created_at
           FROM orders WHERE bar_id = ?
           ORDER BY created_at DESC LIMIT 10`,
          barId
        ),
      });
    })
  );

  router.delete(
    "/:id",
    route((req, res) => {
      const barId = ownBar(req, res);
      const bar = findBar(db, barId);

      // Everything below the bar goes with it, so make it deliberate.
      if (optionalText(req.body, "confirmationName") !== bar.name) {
        throw HttpError.badRequest(
          "Confirmation failed. Please type the exact bar name to confirm deletion."
        );
      }

      run(db, "DELETE FROM bars WHERE id = ?", barId);

      res.json({
        success: true,
        message: `Bar "${bar.name}" and all associated data deleted successfully`,
      });
    })
  );

  // A new link for the QR code. Everyone still holding the old one is out,
  // which is the point — a code that can never be retired means last year's
  // guests can still read the menu.
  router.post(
    "/:id/rotate-guest-link",
    route((req, res) => {
      const barId = ownBar(req, res);
      findBar(db, barId);

      run(
        db,
        "UPDATE bars SET guest_token = ? WHERE id = ?",
        randomBytes(24).toString("base64url"),
        barId
      );

      res.json({ success: true });
    })
  );

  router.get(
    "/:id/qrcode",
    route(async (req, res) => {
      const barId = idParam(req, "id");
      requireBartenderForBar(res, barId);
      const bar = findBar(db, barId);

      // Prefer a configured address, otherwise the one the request arrived on
      // so the code points back at this same server.
      const baseUrl = publicUrl || `${req.protocol}://${req.get("host")}`;
      const url = `${baseUrl}/bar/${barId}?token=${guestToken(bar)}`;

      const code = {
        barId: bar.id,
        barName: bar.name,
        url,
        qrCode: await QRCode.toDataURL(url, {
          width: 512,
          margin: 2,
          color: { dark: "#1e40af", light: "#ffffff" },
        }),
      } satisfies BarQrCode;

      res.json(code);
    })
  );

  // The regulars who have claimed a name at this bar. Bartender-only; the
  // list never carries a password.
  router.get(
    "/:id/regulars",
    route((req, res) => {
      const barId = ownBar(req, res);
      findBar(db, barId);
      res.json(listRegulars(db, barId));
    })
  );

  // Rename a regular, moving their favourites and past orders with them. For
  // the bartender to fix a name or tell two same-named regulars apart.
  router.put(
    "/:id/regulars/:accountId",
    route((req, res) => {
      const barId = ownBar(req, res);
      findBar(db, barId);
      const accountId = idParam(req, "accountId");
      const name = requireText(req.body, "name", { min: 2, label: "Name" });
      res.json(renameRegular(db, barId, accountId, name));
    })
  );

  // Reset a regular's password. No old password asked for — the bartender is
  // trusted, and this is the way back in for a regular who forgot theirs.
  router.put(
    "/:id/regulars/:accountId/password",
    route(async (req, res) => {
      const barId = ownBar(req, res);
      findBar(db, barId);
      const accountId = idParam(req, "accountId");
      const newPassword = requireText(req.body, "newPassword", {
        label: "Password",
      });
      await setRegularPassword(db, barId, accountId, newPassword);
      res.json({ success: true });
    })
  );

  router.post(
    "/:id/guest-token-login",
    route(async (req, res) => {
      const barId = idParam(req, "id");
      const token = requireText(req.body, "token");
      const customerName = requireText(req.body, "customerName", {
        min: 2,
        label: "Customer name",
      });

      const bar = findBar(db, barId);

      if (token !== guestToken(bar)) {
        throw new HttpError(401, "Invalid or expired token");
      }

      // The QR link gets you a session; it isn't one itself. A claimed name
      // still has to be proved with its password before the session is set.
      const resolved = await resolveGuest(
        db,
        bar.id,
        customerName,
        optionalText(req.body, "accountPassword")
      );

      setSessionCookie(res, {
        barId: bar.id,
        role: "guest",
        name: resolved.name,
        ...(resolved.authenticated ? { authenticated: true } : {}),
      });

      // The same shape every other sign-in sends, so the pages read one thing:
      // the whole bar, the name, and whether a password was proved.
      res.json({
        success: true,
        userType: "guest",
        bar: publicBar(bar),
        customerName: resolved.name,
        authenticated: resolved.authenticated,
      } satisfies SignedIn);
    })
  );

  return router;
}
