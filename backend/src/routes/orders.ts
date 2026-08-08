import express, { type Router } from "express";

import type { Order, OrderForBartender } from "../../../shared/types.js";
import {
  HttpError,
  idParam,
  optionalText,
  requireId,
  requireText,
  route,
} from "../http.js";
import {
  all,
  count,
  findBar,
  findDrink,
  findOrder,
  one,
  run,
  type Db,
} from "../db/queries.js";
import { liveUpdates } from "../realtime.js";
import { assertCanMove, isOrderStatus, OPEN_STATUSES } from "../orders/status.js";

/** Orders a guest is still waiting on. */
const OPEN = OPEN_STATUSES.map((s) => `'${s}'`).join(", ");

const WITH_RECIPE = `
  SELECT o.*, d.recipe AS drink_recipe
  FROM orders o
  LEFT JOIN drinks d ON o.drink_id = d.id AND o.bar_id = d.bar_id
`;

/** Keeps a caller-supplied day count from reaching SQL unchecked. */
function periodInDays(raw: unknown): number {
  const days = Number(raw ?? 7);
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw HttpError.badRequest("days must be a whole number between 1 and 365");
  }
  return days;
}

export default function createOrderRoutes(db: Db): Router {
  const router = express.Router();

  router.get(
    "/bar/:barId",
    route((req, res) => {
      const barId = idParam(req, "barId");
      const { status, customerName } = req.query;
      const limit = Math.min(Number(req.query["limit"] ?? 100) || 100, 500);

      const filters: string[] = ["o.bar_id = ?"];
      const params: unknown[] = [barId];

      if (typeof status === "string") {
        filters.push("o.status = ?");
        params.push(status);
      }

      if (typeof customerName === "string") {
        filters.push("o.customer_name = ?");
        params.push(customerName);
      }

      res.json(
        all<OrderForBartender>(
          db,
          `${WITH_RECIPE} WHERE ${filters.join(" AND ")}
           ORDER BY o.created_at DESC LIMIT ?`,
          ...params,
          limit
        )
      );
    })
  );

  router.get(
    "/bar/:barId/pending",
    route((req, res) => {
      res.json(
        all<OrderForBartender>(
          db,
          `${WITH_RECIPE} WHERE o.bar_id = ? AND o.status IN (${OPEN})
           ORDER BY o.created_at ASC`,
          idParam(req, "barId")
        )
      );
    })
  );

  router.get(
    "/bar/:barId/customer/:customerName",
    route((req, res) => {
      const barId = idParam(req, "barId");
      const customerName = decodeURIComponent(req.params.customerName ?? "");

      res.json(
        one<Order>(
          db,
          `SELECT * FROM orders
           WHERE bar_id = ? AND customer_name = ? AND status IN (${OPEN})
           ORDER BY created_at DESC LIMIT 1`,
          barId,
          customerName
        ) ?? null
      );
    })
  );

  router.post(
    "/",
    route((req, res) => {
      const barId = requireId(req.body, "barId");
      const drinkId = requireId(req.body, "drinkId");
      const customerName = requireText(req.body, "customerName");
      const drinkTitle = requireText(req.body, "drinkTitle");

      const bar = findBar(db, barId);
      const drink = findDrink(db, drinkId, barId);

      if (!drink.in_stock) {
        throw HttpError.badRequest("Drink is currently out of stock");
      }

      const waiting = one<Pick<Order, "id">>(
        db,
        `SELECT id FROM orders
         WHERE bar_id = ? AND customer_name = ? AND status IN (${OPEN})`,
        barId,
        customerName
      );

      if (waiting) {
        throw HttpError.badRequest("Customer already has a pending order");
      }

      // A bar can be set to skip the accept step.
      const status = bar.skip_approval ? "accepted" : "new";

      const { lastInsertRowid } = run(
        db,
        `INSERT INTO orders (bar_id, customer_name, drink_id, drink_title, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        barId,
        customerName,
        drinkId,
        drinkTitle,
        status
      );

      const order = findOrder(db, Number(lastInsertRowid), barId);

      liveUpdates(req)?.broadcast(barId, { type: "new_order", order });

      res.status(201).json(order);
    })
  );

  router.patch(
    "/:orderId/status",
    route((req, res) => {
      const orderId = idParam(req, "orderId");
      const barId = requireId(req.body, "barId");
      const status = requireText(req.body, "status");

      if (!isOrderStatus(status)) throw HttpError.badRequest("Invalid status");

      const current = findOrder(db, orderId, barId);
      assertCanMove(current.status, status);

      run(
        db,
        `UPDATE orders SET status = ?, updated_at = datetime('now')
         WHERE id = ? AND bar_id = ?`,
        status,
        orderId,
        barId
      );

      const order = findOrder(db, orderId, barId);

      liveUpdates(req)?.broadcast(barId, {
        type: "order_status_updated",
        order,
      });

      res.json(order);
    })
  );

  router.get(
    "/bar/:barId/analytics",
    route((req, res) => {
      const barId = idParam(req, "barId");
      const days = periodInDays(req.query["days"]);
      // A window expressed for SQLite, built from a checked number.
      const since = `-${days} days`;

      const peakHours = all<{ hour: string; order_count: number }>(
        db,
        `SELECT strftime('%H', created_at) AS hour, COUNT(*) AS order_count
         FROM orders
         WHERE bar_id = ? AND created_at >= datetime('now', ?)
         GROUP BY hour ORDER BY order_count DESC LIMIT 5`,
        barId,
        since
      ).map((row) => ({ hour: `${row.hour}:00`, count: row.order_count }));

      const averagePerDay =
        one<{ avg_per_day: number | null }>(
          db,
          `SELECT COUNT(*) / CAST(julianday('now') - julianday(MIN(created_at)) AS INTEGER) AS avg_per_day
           FROM orders
           WHERE bar_id = ? AND created_at >= datetime('now', ?)`,
          barId,
          since
        )?.avg_per_day ?? 0;

      res.json({
        totalOrders: count(
          db,
          "SELECT COUNT(*) AS n FROM orders WHERE bar_id = ?",
          barId
        ),
        ordersToday: count(
          db,
          `SELECT COUNT(*) AS n FROM orders
           WHERE bar_id = ? AND date(created_at) = date('now')`,
          barId
        ),
        recentOrders: count(
          db,
          `SELECT COUNT(*) AS n FROM orders
           WHERE bar_id = ? AND created_at >= datetime('now', ?)`,
          barId,
          since
        ),
        popularDrinks: all<{ drink_title: string; order_count: number }>(
          db,
          `SELECT drink_title, COUNT(*) AS order_count FROM orders
           WHERE bar_id = ? GROUP BY drink_title
           ORDER BY order_count DESC LIMIT 5`,
          barId
        ),
        peakHours,
        statusDistribution: all<{ status: string; count: number }>(
          db,
          `SELECT status, COUNT(*) AS count FROM orders
           WHERE bar_id = ? AND created_at >= datetime('now', ?)
           GROUP BY status`,
          barId,
          since
        ),
        averageOrdersPerDay: Math.round(averagePerDay * 10) / 10,
        period: `${days} days`,
      });
    })
  );

  router.delete(
    "/:orderId",
    route((req, res) => {
      const orderId = idParam(req, "orderId");
      const barId = requireId(req.body, "barId");
      const customerName = optionalText(req.body, "customerName");

      const order = findOrder(db, orderId, barId);

      // A guest may cancel their own order, and only before it is handed over.
      if (customerName) {
        if (order.customer_name !== customerName) {
          throw new HttpError(403, "You can only cancel your own orders");
        }
        if (order.status === "processed") {
          throw HttpError.badRequest(
            "You cannot cancel orders that have been completed"
          );
        }
      }

      run(db, "DELETE FROM orders WHERE id = ? AND bar_id = ?", orderId, barId);

      liveUpdates(req)?.broadcast(barId, { type: "order_deleted", orderId });

      res.json({ success: true, message: "Order deleted successfully" });
    })
  );

  return router;
}
