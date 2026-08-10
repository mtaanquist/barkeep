import express, { type Router } from "express";

import type { OperatorBar } from "../../../shared/types.js";
import {
  HttpError,
  idParam,
  optionalText,
  requireText,
  route,
} from "../http.js";
import { all, one, run, type Db } from "../db/queries.js";
import { requireOperator } from "../auth/middleware.js";
import {
  clearOperatorCookie,
  operatorEnabled,
  operatorPasswordMatches,
  setOperatorCookie,
} from "../auth/operator.js";

interface OperatorRoutesOptions {
  db: Db;
  /** Left undefined when no OPERATOR_PASSWORD is set, which switches the panel off. */
  operatorPassword?: string | undefined;
}

export default function createOperatorRoutes({
  db,
  operatorPassword,
}: OperatorRoutesOptions): Router {
  const router = express.Router();

  router.post(
    "/login",
    route((req, res) => {
      const password = requireText(req.body, "password");

      // A panel that isn't configured and a wrong password look the same from
      // outside, so an unset install gives nothing away.
      if (
        !operatorEnabled(operatorPassword) ||
        !operatorPasswordMatches(password, operatorPassword)
      ) {
        throw HttpError.unauthorized("Invalid password");
      }

      setOperatorCookie(res);
      res.json({ success: true });
    })
  );

  router.post(
    "/logout",
    route((_req, res) => {
      clearOperatorCookie(res);
      res.json({ success: true });
    })
  );

  // Who the operator cookie says you are. The panel checks this on load.
  router.get(
    "/me",
    route((req, res) => {
      requireOperator(req);
      res.json({ operator: true });
    })
  );

  // Every bar, retired ones included, live first. Its own query rather than
  // findBar, which hides the retired ones from everyone else.
  router.get(
    "/bars",
    route((req, res) => {
      requireOperator(req);

      res.json(
        all<OperatorBar>(
          db,
          `SELECT
             b.id,
             b.name,
             b.created_at,
             b.deleted_at AS deletedAt,
             (SELECT MAX(created_at) FROM orders WHERE bar_id = b.id) AS lastUsed,
             (SELECT COUNT(*) FROM drinks WHERE bar_id = b.id) AS drinkCount,
             (SELECT COUNT(*) FROM orders WHERE bar_id = b.id) AS orderCount
           FROM bars b
           ORDER BY b.deleted_at IS NOT NULL, b.created_at DESC`
        )
      );
    })
  );

  // Retire a bar. It stays recoverable until the purge clears it, so this marks
  // rather than deletes. Type-the-name, the same are-you-sure as the old delete.
  router.delete(
    "/bars/:id",
    route((req, res) => {
      requireOperator(req);
      const barId = idParam(req, "id");

      const bar = one<{ name: string }>(
        db,
        "SELECT name FROM bars WHERE id = ?",
        barId
      );
      if (!bar) throw HttpError.notFound("Bar not found");

      if (optionalText(req.body, "confirmationName") !== bar.name) {
        throw HttpError.badRequest(
          "Confirmation failed. Please type the exact bar name to confirm."
        );
      }

      run(
        db,
        "UPDATE bars SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL",
        barId
      );

      res.json({ success: true });
    })
  );

  // Bring a retired bar back, any time before the purge takes it for good.
  router.post(
    "/bars/:id/restore",
    route((req, res) => {
      requireOperator(req);
      const barId = idParam(req, "id");

      const bar = one<{ id: number }>(
        db,
        "SELECT id FROM bars WHERE id = ?",
        barId
      );
      if (!bar) throw HttpError.notFound("Bar not found");

      run(db, "UPDATE bars SET deleted_at = NULL WHERE id = ?", barId);

      res.json({ success: true });
    })
  );

  return router;
}
