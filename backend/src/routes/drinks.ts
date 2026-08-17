import express, {
  type RequestHandler,
  type Response,
  type Router,
} from "express";
import multer from "multer";
import fs from "fs";
import path from "path";

import type {
  Drink,
  DrinkAnalytics,
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
import {
  requireBarMember,
  requireBartender,
  requireBartenderForBar,
  requireGuest,
} from "../auth/middleware.js";
import { deletePhotoIfUnused, isStoredPhoto } from "../uploads.js";
import {
  extensionFor,
  isAllowedImageType,
  preparePhoto,
  sniffImageFile,
  type AllowedImageType,
} from "../images.js";

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

/**
 * A signed-in member of this bar. A guest may only ask by their own name, so
 * one guest can't read another's list by putting a different name in the
 * address; the bartender may look up anyone.
 */
function ownList(res: Response, barId: number, name: string): void {
  const session = requireBarMember(res, barId);
  if (session.role === "guest" && session.name !== name) {
    throw HttpError.forbidden("You can only see your own list");
  }
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

  // Only the bartender may upload, and this is checked before multer writes a
  // thing — so an unsigned request can't drop files on the photos folder.
  const bartenderOnly: RequestHandler = (_req, res, next) => {
    try {
      requireBartender(res);
      next();
    } catch (err) {
      next(err);
    }
  };

  const upload = multer({
    storage: multer.diskStorage({
      destination(_req, _file, cb) {
        fs.mkdirSync(uploadsDir, { recursive: true });
        cb(null, uploadsDir);
      },
      filename(_req, file, cb) {
        // The extension comes from the type we accepted, not the name the
        // browser sent, so a "photo.svg" can't be served back as an SVG.
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const ext = extensionFor(file.mimetype as AllowedImageType);
        cb(null, `drink-${unique}${ext}`);
      },
    }),
    limits: { fileSize: MAX_PHOTO_BYTES },
    fileFilter(_req, file, cb) {
      // Raster pictures only. SVG and everything else is turned away, because
      // an SVG served from our own address could run script in a guest's page.
      if (isAllowedImageType(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error("Only image files are allowed!"));
      }
    },
  });

  /**
   * A photo we still have, or nothing. A page open while the bar was upgraded
   * knows photos by the names they had before it renamed them.
   */
  function onFileOrNothing(sent: unknown): string | null {
    if (!sent) return null;
    if (!isStoredPhoto(sent)) return String(sent);
    return fs.existsSync(path.join(uploadsDir, path.basename(sent)))
      ? sent
      : null;
  }

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
      const barId = idParam(req, "barId");
      requireBartenderForBar(res, barId);
      res.json(
        all<DrinkWithCategory>(
          db,
          `${WITH_CATEGORY} WHERE d.bar_id = ? ORDER BY d.created_at DESC`,
          barId
        )
      );
    })
  );

  router.get(
    "/bar/:barId/guest",
    route((req, res) => {
      const barId = idParam(req, "barId");
      requireBarMember(res, barId);
      res.json(
        asGuestSees(
          all<DrinkWithCategory>(
            db,
            `${WITH_CATEGORY} WHERE d.bar_id = ? ORDER BY d.created_at DESC`,
            barId
          )
        )
      );
    })
  );

  router.get(
    "/bar/:barId/drink/:drinkId",
    route((req, res) => {
      const barId = idParam(req, "barId");
      requireBartenderForBar(res, barId);
      res.json(findDrink(db, idParam(req, "drinkId"), barId));
    })
  );

  router.post(
    "/upload-image",
    bartenderOnly,
    upload.single("image"),
    route(async (req, res) => {
      if (!req.file) throw HttpError.badRequest("No image file provided");

      // The filter trusted the browser's label; this checks the bytes really
      // are one of the pictures we accept. A file that isn't is dropped, not
      // left on disk for the sweep to find a day later.
      if (!sniffImageFile(req.file.path)) {
        fs.unlinkSync(req.file.path);
        throw HttpError.badRequest("Only image files are allowed.");
      }

      // A photo off a phone is far bigger than anything here shows it at, and
      // a menu of them is what made the bar slow to open. This also settles it
      // into the one format we keep, which may change the name.
      let settled: string | null;
      try {
        settled = await preparePhoto(req.file.path);
      } catch (error) {
        fs.unlinkSync(req.file.path);

        // Worth saying which, because "not a picture" and "too big to open"
        // send whoever is fixing it looking in different places — and anything
        // else here is the server's fault, not the photo's.
        const why = error instanceof Error ? error.message : String(error);

        if (/pixel limit/i.test(why)) {
          throw HttpError.badRequest(
            "That picture is too large to open. Please use a smaller one."
          );
        }

        if (/unsupported|corrupt|bad|header|magic/i.test(why)) {
          throw HttpError.badRequest("Only image files are allowed.");
        }

        console.error("Could not prepare an uploaded photo:", error);
        throw error;
      }

      if (settled && settled !== req.file.path) fs.unlinkSync(req.file.path);

      const filename = path.basename(settled ?? req.file.path);

      res.json({
        success: true,
        imageUrl: `/uploads/${filename}`,
        filename,
      });
    })
  );

  router.post(
    "/",
    route((req, res) => {
      const { barId } = requireBartender(res);
      const title = requireText(req.body, "title");
      const recipe = requireText(req.body, "recipe");

      findBar(db, barId);

      const body = req.body as Record<string, unknown>;
      const categoryId = body["categoryId"] ? Number(body["categoryId"]) : null;
      if (categoryId) findCategory(db, categoryId, barId);

      // A form left open while the bar was upgraded knows the photo by the
      // name it had before. There is nothing to fall back on for a new drink,
      // so it is saved without one rather than pointing at a gap.
      const photo = onFileOrNothing(body["imageUrl"]);

      const { lastInsertRowid } = run(
        db,
        `INSERT INTO drinks (
           bar_id, title, image_url, recipe, in_stock, base_spirit,
           guest_description, show_recipe_to_guests, category_id,
           image_crop_x, image_crop_y, image_crop_zoom
         ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)`,
        barId,
        title,
        photo,
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
      const { barId } = requireBartender(res);

      const existing = findDrink(db, drinkId, barId);

      const changes = changedColumns(req.body);
      if (changes["category_id"]) {
        findCategory(db, Number(changes["category_id"]), barId);
      }

      // A page left open while the bar was upgraded still knows a photo by the
      // name it had before, and an upgrade can rename photos. Saving from that
      // page would hand back a name that has gone, and the real photo would be
      // thrown away as the one being replaced. Keep what is on file instead.
      const sent = changes["image_url"];
      if (
        isStoredPhoto(sent) &&
        !fs.existsSync(path.join(uploadsDir, path.basename(sent)))
      ) {
        changes["image_url"] = existing.image_url;
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
      const { barId } = requireBartender(res);

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
      const { barId } = requireBartender(res);

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
      requireBartenderForBar(res, barId);

      const report = {
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
      } satisfies DrinkAnalytics;

      res.json(report);
    })
  );

  router.get(
    "/bar/:barId/favourites/:customerName",
    route((req, res) => {
      const barId = idParam(req, "barId");
      const customerName = req.params.customerName ?? "";
      ownList(res, barId, customerName);

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
      const { barId, name } = requireGuest(res);
      const drinkId = requireId(req.body, "drinkId");

      findDrink(db, drinkId, barId);

      const { changes } = run(
        db,
        `INSERT OR IGNORE INTO user_favourites (bar_id, customer_name, drink_id)
         VALUES (?, ?, ?)`,
        barId,
        name,
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
      const { barId, name } = requireGuest(res);
      const drinkId = requireId(req.body, "drinkId");

      const { changes } = run(
        db,
        `DELETE FROM user_favourites
         WHERE bar_id = ? AND customer_name = ? AND drink_id = ?`,
        barId,
        name,
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
      ownList(res, barId, customerName);

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
