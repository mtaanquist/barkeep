import express, { type Router } from "express";
import bcrypt from "bcrypt";
import QRCode from "qrcode";
import { randomBytes } from "node:crypto";

import type {
  Bar,
  BarQrCode,
  Language,
  Order,
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

const LANGUAGES: readonly Language[] = ["en", "da"];

const PASSWORD_RULES = {
  bartender: { min: 4, label: "Bartender password" },
  guest: { min: 3, label: "Guest password" },
} as const;

const HASH_ROUNDS = 12;

/** The bar fields that are safe to list. Never the token or the hashes. */
const PUBLIC_COLUMNS =
  "id, name, language, skip_approval, orders_closed, max_active_orders, created_at";

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

      const taken = one<Pick<Bar, "id">>(
        db,
        "SELECT id FROM bars WHERE name = ?",
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

      // The whole bar goes back, settings and all, so the pages can hold on to
      // it as-is.
      res.status(201).json(publicBar(findBar(db, Number(lastInsertRowid))));
    })
  );

  router.get(
    "/",
    route((req, res) => {
      const limit = Math.min(Number(req.query["limit"] ?? 50) || 50, 200);

      res.json(
        all<Bar>(
          db,
          `SELECT ${PUBLIC_COLUMNS} FROM bars ORDER BY created_at DESC LIMIT ?`,
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
      const barId = idParam(req, "id");
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
            "SELECT COUNT(*) AS n FROM drinks WHERE bar_id = ? AND in_stock = 1",
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
      const barId = idParam(req, "id");
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
      const barId = idParam(req, "id");
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

  router.post(
    "/:id/guest-token-login",
    route((req, res) => {
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

      res.json({
        success: true,
        barId: bar.id,
        barName: bar.name,
        language: bar.language,
        customerName,
        userType: "guest",
      });
    })
  );

  return router;
}
