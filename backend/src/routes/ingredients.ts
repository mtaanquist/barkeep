import express, { type Router } from "express";

import type { Ingredient } from "../../../shared/types.js";
import { HttpError, idParam, requireText, route } from "../http.js";
import {
  all,
  count,
  findIngredient,
  one,
  run,
  type Db,
} from "../db/queries.js";
import {
  requireBartender,
  requireBartenderForBar,
} from "../auth/middleware.js";
import { liveUpdates } from "../realtime.js";

/** An ingredient with how many drinks would go off the menu without it. */
const WITH_USE_COUNT = `
  SELECT i.*,
         (SELECT COUNT(*) FROM drink_ingredients di
          WHERE di.ingredient_id = i.id) AS used_by
  FROM ingredients i
`;

export default function createIngredientRoutes(db: Db): Router {
  const router = express.Router();

  /** Nothing here says who is drinking what, so everyone watching is told. */
  const menuChanged = (req: express.Request, barId: number): void => {
    liveUpdates(req)?.announce(barId, { type: "menu_changed" });
  };

  router.get(
    "/bar/:barId",
    route((req, res) => {
      const barId = idParam(req, "barId");
      requireBartenderForBar(res, barId);

      res.json(
        all<Ingredient & { used_by: number }>(
          db,
          `${WITH_USE_COUNT} WHERE i.bar_id = ? ORDER BY i.name COLLATE NOCASE`,
          barId
        )
      );
    })
  );

  router.post(
    "/",
    route((req, res) => {
      const { barId } = requireBartender(res);
      const name = requireText(req.body, "name");

      const taken = one<Pick<Ingredient, "id">>(
        db,
        "SELECT id FROM ingredients WHERE bar_id = ? AND name = ? COLLATE NOCASE",
        barId,
        name
      );

      if (taken) throw HttpError.badRequest("Ingredient already exists");

      const { lastInsertRowid } = run(
        db,
        "INSERT INTO ingredients (bar_id, name) VALUES (?, ?)",
        barId,
        name
      );

      res.status(201).json(findIngredient(db, Number(lastInsertRowid), barId));
    })
  );

  router.put(
    "/:id",
    route((req, res) => {
      const ingredientId = idParam(req, "id");
      const { barId } = requireBartender(res);
      const name = requireText(req.body, "name");

      findIngredient(db, ingredientId, barId);

      const clash = one<Pick<Ingredient, "id">>(
        db,
        `SELECT id FROM ingredients
         WHERE bar_id = ? AND name = ? COLLATE NOCASE AND id != ?`,
        barId,
        name,
        ingredientId
      );

      if (clash) throw HttpError.badRequest("Ingredient name already exists");

      run(
        db,
        "UPDATE ingredients SET name = ? WHERE id = ? AND bar_id = ?",
        name,
        ingredientId,
        barId
      );

      // The name shows on the menu, so the drinks that use it now read
      // differently.
      menuChanged(req, barId);

      res.json(findIngredient(db, ingredientId, barId));
    })
  );

  router.patch(
    "/:id/stock",
    route((req, res) => {
      const ingredientId = idParam(req, "id");
      const { barId } = requireBartender(res);

      const ingredient = findIngredient(db, ingredientId, barId);

      run(
        db,
        "UPDATE ingredients SET in_stock = ? WHERE id = ? AND bar_id = ?",
        ingredient.in_stock ? 0 : 1,
        ingredientId,
        barId
      );

      // This is the whole point of the feature: one switch, and every drink
      // that needs it leaves or rejoins the menu at once.
      menuChanged(req, barId);

      res.json(findIngredient(db, ingredientId, barId));
    })
  );

  router.delete(
    "/:id",
    route((req, res) => {
      const ingredientId = idParam(req, "id");
      const { barId } = requireBartender(res);

      findIngredient(db, ingredientId, barId);

      const inUse = count(
        db,
        "SELECT COUNT(*) AS n FROM drink_ingredients WHERE ingredient_id = ?",
        ingredientId
      );

      if (inUse > 0) {
        throw HttpError.badRequest(
          `Cannot delete ingredient: ${inUse} drink(s) use it. Please take it off those drinks first.`
        );
      }

      run(
        db,
        "DELETE FROM ingredients WHERE id = ? AND bar_id = ?",
        ingredientId,
        barId
      );

      res.json({ message: "Ingredient deleted successfully" });
    })
  );

  return router;
}
