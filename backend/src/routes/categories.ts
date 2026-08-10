import express, { type Router } from "express";

import type { Category } from "../../../shared/types.js";
import { HttpError, idParam, requireText, route } from "../http.js";
import { all, count, findCategory, one, run, type Db } from "../db/queries.js";
import {
  requireBartender,
  requireBartenderForBar,
} from "../auth/middleware.js";

export default function createCategoryRoutes(db: Db): Router {
  const router = express.Router();

  router.get(
    "/bar/:barId",
    route((req, res) => {
      const barId = idParam(req, "barId");
      requireBartenderForBar(res, barId);

      res.json(
        all<Category>(
          db,
          "SELECT * FROM categories WHERE bar_id = ? ORDER BY name ASC",
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

      const taken = one<Pick<Category, "id">>(
        db,
        "SELECT id FROM categories WHERE bar_id = ? AND name = ?",
        barId,
        name
      );

      if (taken) throw HttpError.badRequest("Category already exists");

      const { lastInsertRowid } = run(
        db,
        "INSERT INTO categories (bar_id, name) VALUES (?, ?)",
        barId,
        name
      );

      res
        .status(201)
        .json(findCategory(db, Number(lastInsertRowid), barId));
    })
  );

  router.put(
    "/:id",
    route((req, res) => {
      const categoryId = idParam(req, "id");
      const { barId } = requireBartender(res);
      const name = requireText(req.body, "name");

      findCategory(db, categoryId, barId);

      const clash = one<Pick<Category, "id">>(
        db,
        "SELECT id FROM categories WHERE bar_id = ? AND name = ? AND id != ?",
        barId,
        name,
        categoryId
      );

      if (clash) throw HttpError.badRequest("Category name already exists");

      run(
        db,
        "UPDATE categories SET name = ? WHERE id = ? AND bar_id = ?",
        name,
        categoryId,
        barId
      );

      res.json(findCategory(db, categoryId, barId));
    })
  );

  router.delete(
    "/:id",
    route((req, res) => {
      const categoryId = idParam(req, "id");
      const { barId } = requireBartender(res);

      findCategory(db, categoryId, barId);

      const inUse = count(
        db,
        "SELECT COUNT(*) AS n FROM drinks WHERE category_id = ?",
        categoryId
      );

      if (inUse > 0) {
        throw HttpError.badRequest(
          `Cannot delete category: ${inUse} drink(s) are assigned to this category. Please reassign or remove those drinks first.`
        );
      }

      run(
        db,
        "DELETE FROM categories WHERE id = ? AND bar_id = ?",
        categoryId,
        barId
      );

      res.json({ message: "Category deleted successfully" });
    })
  );

  return router;
}
