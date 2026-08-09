import express, { type Router } from "express";
import bcrypt from "bcrypt";

import type { SignedIn, UserType } from "../../../shared/types.js";
import { HttpError, requireId, requireText, route } from "../http.js";
import {
  findBar,
  publicBar,
  run,
  type BarRow,
  type Db,
} from "../db/queries.js";

/** Which stored password a sign-in should be checked against. */
const PASSWORD_FIELD = {
  bartender: "bartender_password_hash",
  guest: "guest_password_hash",
} as const satisfies Record<UserType, keyof BarRow>;

/**
 * The reply to a sign-in. The whole bar goes back, so the pages never have to
 * piece one together from loose fields and lose its settings doing it.
 */
function signedInAs(bar: BarRow, userType: UserType): SignedIn {
  return { success: true, userType, bar: publicBar(bar) };
}

export default function createAuthRoutes(db: Db): Router {
  const router = express.Router();

  /** Both sign-ins differ only in which password they check. */
  async function signIn(body: unknown, userType: UserType): Promise<BarRow> {
    const barId = requireId(body, "barId");
    const password = requireText(body, "password");

    const bar = findBar(db, barId);
    const matches = await bcrypt.compare(password, bar[PASSWORD_FIELD[userType]]);

    if (!matches) throw new HttpError(401, "Invalid password");

    return bar;
  }

  router.post(
    "/bartender",
    route(async (req, res) => {
      const bar = await signIn(req.body, "bartender");

      // The bartender arriving is the bar opening. Last night's closing —
      // whether it was the switch or the time — is cleared, so nobody has
      // to remember to undo it before the next party.
      if (bar.orders_closed === 1 || bar.last_orders_at) {
        run(
          db,
          "UPDATE bars SET orders_closed = 0, last_orders_at = NULL WHERE id = ?",
          bar.id
        );
        return res.json(signedInAs(findBar(db, bar.id), "bartender"));
      }

      res.json(signedInAs(bar, "bartender"));
    })
  );

  router.post(
    "/guest",
    route(async (req, res) => {
      const customerName = requireText(req.body, "customerName", {
        min: 2,
        label: "Customer name",
      });
      const bar = await signIn(req.body, "guest");

      res.json({ ...signedInAs(bar, "guest"), customerName });
    })
  );

  router.post(
    "/verify",
    route((req, res) => {
      const barId = requireId(req.body, "barId");
      const userType = requireText(req.body, "userType");
      const bar = findBar(db, barId);

      res.json(signedInAs(bar, userType as UserType));
    })
  );

  return router;
}
