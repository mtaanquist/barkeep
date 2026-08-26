import express, { type Router } from "express";

import type {
  Order,
  OrderAnalytics,
  OrderForBartender,
  OrderStatus,
} from "../../../shared/types.js";
import {
  HttpError,
  idParam,
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
import { drinkIsAvailable } from "../db/drinkIngredients.js";
import {
  requireBarMember,
  requireBartender,
  requireBartenderForBar,
  requireGuest,
  requireSession,
} from "../auth/middleware.js";
import { liveUpdates } from "../realtime.js";
import { assertCanMove, isOrderStatus, OPEN_STATUSES } from "../orders/status.js";
import { ordersAreClosed } from "../orders/closing.js";

/** Orders a guest is still waiting on. */
const OPEN = OPEN_STATUSES.map((s) => `'${s}'`).join(", ");

const WITH_RECIPE = `
  SELECT o.*, d.recipe AS drink_recipe
  FROM orders o
  LEFT JOIN drinks d ON o.drink_id = d.id AND o.bar_id = d.bar_id
`;

/**
 * The recipe rides along on an order so the bartender can make the drink. A
 * guest reading their own orders has no use for it, and the bar may have
 * chosen to keep it back — so it does not go out with their list at all.
 *
 * Stricter than the drinks routes, which hand a guest the recipe when the
 * bartender has said they may see it. That is the place to read a recipe; an
 * order is not, so this does not check the setting.
 */
function withoutRecipe(orders: OrderForBartender[]): OrderForBartender[] {
  return orders.map((order) => ({ ...order, drink_recipe: null }));
}

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
      // Both the bartender's queue and the guest's own view read this, so it's
      // open to anyone signed in to this bar — but nobody else.
      const session = requireBarMember(res, barId);
      const { status, customerName } = req.query;
      const limit = Math.min(Number(req.query["limit"] ?? 100) || 100, 500);

      const filters: string[] = ["o.bar_id = ?"];
      const params: unknown[] = [barId];

      if (typeof status === "string") {
        filters.push("o.status = ?");
        params.push(status);
      }

      // The bartender sees the whole room and may narrow by name. A guest only
      // ever sees their own orders — the name comes from their cookie, so they
      // can't widen it to anyone else's by asking.
      const onlyName =
        session.role === "guest"
          ? (session.name ?? "")
          : typeof customerName === "string"
            ? customerName
            : null;

      if (onlyName !== null) {
        filters.push("o.customer_name = ?");
        params.push(onlyName);
      }

      const orders = all<OrderForBartender>(
        db,
        `${WITH_RECIPE} WHERE ${filters.join(" AND ")}
         ORDER BY o.created_at DESC LIMIT ?`,
        ...params,
        limit
      );

      res.json(session.role === "guest" ? withoutRecipe(orders) : orders);
    })
  );

  router.get(
    "/bar/:barId/pending",
    route((req, res) => {
      const barId = idParam(req, "barId");
      requireBartenderForBar(res, barId);
      res.json(
        all<OrderForBartender>(
          db,
          `${WITH_RECIPE} WHERE o.bar_id = ? AND o.status IN (${OPEN})
           ORDER BY o.created_at ASC`,
          barId
        )
      );
    })
  );

  router.get(
    "/bar/:barId/customer/:customerName",
    route((req, res) => {
      const barId = idParam(req, "barId");
      const customerName = decodeURIComponent(req.params.customerName ?? "");

      // A guest may only look up their own waiting order; the bartender, anyone's.
      const session = requireBarMember(res, barId);
      if (session.role === "guest" && session.name !== customerName) {
        throw HttpError.forbidden("You can only see your own orders");
      }

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
      // The name on the order is the one the guest signed in with, so nobody
      // can order under someone else's name.
      const { barId, name: customerName } = requireGuest(res);
      const drinkId = requireId(req.body, "drinkId");

      const bar = findBar(db, barId);
      const drink = findDrink(db, drinkId, barId);

      // Last orders. What is already in still gets served; nothing new joins.
      if (ordersAreClosed(bar)) {
        throw HttpError.badRequest("The bar has stopped taking orders", "orders_closed");
      }

      // Switched off by the bartender, or something it needs has run out —
      // either way it cannot be made tonight.
      if (!drinkIsAvailable(db, drinkId)) {
        throw HttpError.badRequest("Drink is currently out of stock", "drink_out_of_stock");
      }

      const waiting = count(
        db,
        `SELECT COUNT(*) AS n FROM orders
         WHERE bar_id = ? AND customer_name = ? AND status IN (${OPEN})`,
        barId,
        customerName
      );

      // How many a guest may have on the go is the bar's to decide.
      if (waiting >= (bar.max_active_orders || 1)) {
        throw HttpError.badRequest(
          "You already have as many orders on the go as this bar allows",
          "order_limit_reached"
        );
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
        // The title is the drink's own, not whatever the client sent, so the
        // queue and the takings always show the real name.
        drink.title,
        status
      );

      const order = findOrder(db, Number(lastInsertRowid), barId);

      liveUpdates(req)?.broadcast(
        barId,
        { type: "new_order", order },
        order.customer_name
      );

      res.status(201).json(order);
    })
  );

  router.patch(
    "/:orderId/status",
    route((req, res) => {
      const orderId = idParam(req, "orderId");
      const { barId } = requireBartender(res);
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

      liveUpdates(req)?.broadcast(
        barId,
        { type: "order_status_updated", order },
        order.customer_name
      );

      res.json(order);
    })
  );

  router.get(
    "/bar/:barId/analytics",
    route((req, res) => {
      const barId = idParam(req, "barId");
      requireBartenderForBar(res, barId);
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

      const report = {
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
        statusDistribution: all<{ status: OrderStatus; count: number }>(
          db,
          `SELECT status, COUNT(*) AS count FROM orders
           WHERE bar_id = ? AND created_at >= datetime('now', ?)
           GROUP BY status`,
          barId,
          since
        ),
        averageOrdersPerDay: Math.round(averagePerDay * 10) / 10,
        period: `${days} days`,
      } satisfies OrderAnalytics;

      res.json(report);
    })
  );

  router.delete(
    "/:orderId",
    route((req, res) => {
      const orderId = idParam(req, "orderId");
      const session = requireSession(res);
      const { barId } = session;

      const order = findOrder(db, orderId, barId);

      // The bartender may cancel anything in their bar. A guest may cancel only
      // their own order, and only before it is handed over.
      if (session.role === "guest") {
        if (order.customer_name !== session.name) {
          throw new HttpError(403, "You can only cancel your own orders");
        }
        if (order.status === "processed") {
          throw HttpError.badRequest(
            "You cannot cancel orders that have been completed"
          );
        }
      }

      run(db, "DELETE FROM orders WHERE id = ? AND bar_id = ?", orderId, barId);

      // The order is gone, but we still know whose it was, so the guest who
      // placed it is told it went away.
      liveUpdates(req)?.broadcast(
        barId,
        { type: "order_deleted", orderId },
        order.customer_name
      );

      res.json({ success: true, message: "Order deleted successfully" });
    })
  );

  return router;
}
