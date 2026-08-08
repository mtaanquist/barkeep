import express, { type Router } from "express";
import bcrypt from "bcrypt";

import type { UserType } from "../../../shared/types.js";
import { HttpError, requireId, requireText, route } from "../http.js";
import { findBar, type BarRow, type Db } from "../db/queries.js";

/** Which stored password a sign-in should be checked against. */
const PASSWORD_FIELD = {
  bartender: "bartender_password_hash",
  guest: "guest_password_hash",
} as const satisfies Record<UserType, keyof BarRow>;

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

      res.json({
        success: true,
        barId: bar.id,
        barName: bar.name,
        language: bar.language,
        userType: "bartender",
      });
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

  router.post(
    "/verify",
    route((req, res) => {
      const barId = requireId(req.body, "barId");
      const userType = requireText(req.body, "userType");
      const bar = findBar(db, barId);

      res.json({
        success: true,
        barId: bar.id,
        barName: bar.name,
        language: bar.language,
        userType,
      });
    })
  );

  return router;
}
