import express, { type Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

import type {
  Drink,
  DrinkForGuest,
  DrinkWithCategory,
} from "../../../shared/types.js";
import {
  HttpError,
  idParam,
  requireId,
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
  findCategory,
  findDrink,
  run,
  type Db,
} from "../db/queries.js";
import { deletePhotoIfUnused } from "../uploads.js";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const WITH_CATEGORY = `
  SELECT d.*, c.name AS category_name
  FROM drinks d
  LEFT JOIN categories c ON d.category_id = c.id
`;

/**
 * Guests only see a recipe when the bartender has said they can. Applied
 * everywhere a guest reads drinks.
 */
function asGuestSees<T extends Drink>(drinks: T[]): T[] {
  return drinks.map((drink) =>
    drink.show_recipe_to_guests ? drink : { ...drink, recipe: null }
  );
}

interface DrinkRoutesOptions {
  db: Db;
  uploadsDir: string;
}

export default function createDrinkRoutes({
  db,
  uploadsDir,
}: DrinkRoutesOptions): Router {
  const router = express.Router();

  const upload = multer({
    storage: multer.diskStorage({
      destination(_req, _file, cb) {
        fs.mkdirSync(uploadsDir, { recursive: true });
        cb(null, uploadsDir);
      },
      filename(_req, file, cb) {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `drink-${unique}${path.extname(file.originalname)}`);
      },
    }),
    limits: { fileSize: MAX_PHOTO_BYTES },
    fileFilter(_req, file, cb) {
      if (file.mimetype.startsWith("image/")) {
        cb(null, true);
      } else {
        cb(new Error("Only image files are allowed!"));
      }
    },
  });

  /** Turns whichever fields were sent into the columns they belong to. */
  function changedColumns(body: unknown): Record<string, unknown> {
    const sent = <T>(field: string, convert: (value: unknown) => T) =>
      wasSent(body, field)
        ? convert((body as Record<string, unknown>)[field])
        : undefined;

    return {
      title: sent("title", (v) => String(v).trim()),
      image_url: sent("imageUrl", (v) => v || null),
      recipe: sent("recipe", (v) => String(v).trim()),
      in_stock: sent("inStock", toFlag),
      base_spirit: sent("baseSpirit", (v) => v || null),
      guest_description: sent("guestDescription", (v) => v || null),
      show_recipe_to_guests: sent("showRecipeToGuests", toFlag),
      category_id: sent("categoryId", (v) => v || null),
      image_crop_x: sent("imageCropX", Number),
      image_crop_y: sent("imageCropY", Number),
      image_crop_zoom: sent("imageCropZoom", Number),
    };
  }

  router.get(
    "/bar/:barId",
    route((req, res) => {
      res.json(
        all<DrinkWithCategory>(
          db,
          `${WITH_CATEGORY} WHERE d.bar_id = ? ORDER BY d.created_at DESC`,
          idParam(req, "barId")
        )
      );
    })
  );

  router.get(
    "/bar/:barId/guest",
    route((req, res) => {
      res.json(
        asGuestSees(
          all<DrinkWithCategory>(
            db,
            `${WITH_CATEGORY} WHERE d.bar_id = ? ORDER BY d.created_at DESC`,
            idParam(req, "barId")
          )
        )
      );
    })
  );

  router.get(
    "/bar/:barId/drink/:drinkId",
    route((req, res) => {
      res.json(findDrink(db, idParam(req, "drinkId"), idParam(req, "barId")));
    })
  );

  router.post(
    "/upload-image",
    upload.single("image"),
    route((req, res) => {
      if (!req.file) throw HttpError.badRequest("No image file provided");

      res.json({
        success: true,
        imageUrl: `/uploads/${req.file.filename}`,
        filename: req.file.filename,
      });
    })
  );

  router.post(
    "/",
    route((req, res) => {
      const barId = requireId(req.body, "barId");
      const title = requireText(req.body, "title");
      const recipe = requireText(req.body, "recipe");

      findBar(db, barId);

      const body = req.body as Record<string, unknown>;
      const categoryId = body["categoryId"] ? Number(body["categoryId"]) : null;
      if (categoryId) findCategory(db, categoryId, barId);

      const { lastInsertRowid } = run(
        db,
        `INSERT INTO drinks (
           bar_id, title, image_url, recipe, in_stock, base_spirit,
           guest_description, show_recipe_to_guests, category_id,
           image_crop_x, image_crop_y, image_crop_zoom
         ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`,
        barId,
        title,
        body["imageUrl"] || null,
        recipe,
        body["baseSpirit"] || null,
        body["guestDescription"] || null,
        toFlag(body["showRecipeToGuests"]),
        categoryId,
        Number(body["imageCropX"] ?? 0),
        Number(body["imageCropY"] ?? 0),
        Number(body["imageCropZoom"] ?? 1)
      );

      res.status(201).json(findDrink(db, Number(lastInsertRowid), barId));
    })
  );

  router.put(
    "/:drinkId",
    route((req, res) => {
      const drinkId = idParam(req, "drinkId");
      const barId = requireId(req.body, "barId");

      const existing = findDrink(db, drinkId, barId);

      const changes = changedColumns(req.body);
      if (changes["category_id"]) {
        findCategory(db, Number(changes["category_id"]), barId);
      }

      const { clause, values } = buildUpdate(changes);

      // The photo being replaced is no longer needed.
      const nextPhoto = changes["image_url"];
      if (
        nextPhoto !== undefined &&
        existing.image_url &&
        existing.image_url !== nextPhoto
      ) {
        deletePhotoIfUnused({ db, uploadsDir }, existing.image_url, {
          exceptDrinkId: drinkId,
        });
      }

      run(
        db,
        `UPDATE drinks SET ${clause} WHERE id = ? AND bar_id = ?`,
        ...values,
        drinkId,
        barId
      );

      res.json(findDrink(db, drinkId, barId));
    })
  );

  router.patch(
    "/:drinkId/stock",
    route((req, res) => {
      const drinkId = idParam(req, "drinkId");
      const barId = requireId(req.body, "barId");

      const drink = findDrink(db, drinkId, barId);

      run(
        db,
        "UPDATE drinks SET in_stock = ? WHERE id = ? AND bar_id = ?",
        drink.in_stock ? 0 : 1,
        drinkId,
        barId
      );

      res.json(findDrink(db, drinkId, barId));
    })
  );

  router.delete(
    "/:drinkId",
    route((req, res) => {
      const drinkId = idParam(req, "drinkId");
      const barId = requireId(req.body, "barId");

      const drink = findDrink(db, drinkId, barId);

      deletePhotoIfUnused({ db, uploadsDir }, drink.image_url, {
        exceptDrinkId: drinkId,
      });

      run(db, "DELETE FROM drinks WHERE id = ? AND bar_id = ?", drinkId, barId);

      res.json({ success: true, message: "Drink deleted successfully" });
    })
  );

  router.get(
    "/bar/:barId/analytics",
    route((req, res) => {
      const barId = idParam(req, "barId");

      res.json({
        popularDrinks: all<{ drink_title: string; order_count: number }>(
          db,
          `SELECT drink_title, COUNT(*) AS order_count FROM orders
           WHERE bar_id = ? GROUP BY drink_title
           ORDER BY order_count DESC LIMIT 10`,
          barId
        ),
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
      });
    })
  );

  router.get(
    "/bar/:barId/favourites/:customerName",
    route((req, res) => {
      const barId = idParam(req, "barId");
      const customerName = req.params.customerName ?? "";

      res.json(
        asGuestSees(
          all<DrinkForGuest & { favourited_at: string }>(
            db,
            `SELECT d.*, c.name AS category_name,
                    uf.created_at AS favourited_at, 1 AS is_favourite
             FROM drinks d
             LEFT JOIN categories c ON d.category_id = c.id
             INNER JOIN user_favourites uf ON d.id = uf.drink_id
             WHERE uf.bar_id = ? AND uf.customer_name = ? AND d.in_stock = 1
             ORDER BY uf.created_at DESC`,
            barId,
            customerName
          )
        )
      );
    })
  );

  router.post(
    "/bar/:barId/favourites",
    route((req, res) => {
      const barId = idParam(req, "barId");
      const drinkId = requireId(req.body, "drinkId");
      const customerName = requireText(req.body, "customerName");

      findDrink(db, drinkId, barId);

      const { changes } = run(
        db,
        `INSERT OR IGNORE INTO user_favourites (bar_id, customer_name, drink_id)
         VALUES (?, ?, ?)`,
        barId,
        customerName,
        drinkId
      );

      if (changes === 0) {
        throw HttpError.conflict("Drink already in favourites");
      }

      res
        .status(201)
        .json({ success: true, message: "Drink added to favourites" });
    })
  );

  router.delete(
    "/bar/:barId/favourites",
    route((req, res) => {
      const barId = idParam(req, "barId");
      const drinkId = requireId(req.body, "drinkId");
      const customerName = requireText(req.body, "customerName");

      const { changes } = run(
        db,
        `DELETE FROM user_favourites
         WHERE bar_id = ? AND customer_name = ? AND drink_id = ?`,
        barId,
        customerName,
        drinkId
      );

      if (changes === 0) throw HttpError.notFound("Favourite not found");

      res.json({ success: true, message: "Drink removed from favourites" });
    })
  );

  router.get(
    "/bar/:barId/guest/:customerName",
    route((req, res) => {
      const barId = idParam(req, "barId");
      const customerName = req.params.customerName ?? "";

      res.json(
        asGuestSees(
          all<DrinkForGuest>(
            db,
            `SELECT d.*, c.name AS category_name,
                    CASE WHEN uf.drink_id IS NOT NULL THEN 1 ELSE 0 END AS is_favourite
             FROM drinks d
             LEFT JOIN categories c ON d.category_id = c.id
             LEFT JOIN user_favourites uf
               ON d.id = uf.drink_id AND uf.bar_id = d.bar_id AND uf.customer_name = ?
             WHERE d.bar_id = ?
             ORDER BY d.created_at DESC`,
            customerName,
            barId
          )
        )
      );
    })
  );

  return router;
}
