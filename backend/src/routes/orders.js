import express from "express";
import { db } from "../server.js";

const router = express.Router();

// Get all orders for a bar (with optional status filter)
router.get("/bar/:barId", (req, res) => {
  try {
    const barId = req.params.barId;
    const { status, customerName, limit = 100 } = req.query;

    let query = `
      SELECT o.*, d.recipe as drink_recipe
      FROM orders o
      LEFT JOIN drinks d ON o.drink_id = d.id AND o.bar_id = d.bar_id
      WHERE o.bar_id = ?
    `;
    const params = [barId];

    // Add filters
    if (status) {
      query += " AND o.status = ?";
      params.push(status);
    }

    if (customerName) {
      query += " AND o.customer_name = ?";
      params.push(customerName);
    }

    query += " ORDER BY o.created_at DESC LIMIT ?";
    params.push(parseInt(limit));

    const stmt = db.prepare(query);
    const orders = stmt.all(...params);

    res.json(orders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// Get pending orders for bartender dashboard
router.get("/bar/:barId/pending", (req, res) => {
  try {
    const barId = req.params.barId;

    const stmt = db.prepare(`
      SELECT o.*, d.recipe as drink_recipe
      FROM orders o
      LEFT JOIN drinks d ON o.drink_id = d.id AND o.bar_id = d.bar_id
      WHERE o.bar_id = ? AND o.status IN ('new', 'accepted', 'ready') 
      ORDER BY o.created_at ASC
    `);
    const orders = stmt.all(barId);

    res.json(orders);
  } catch (error) {
    console.error("Error fetching pending orders:", error);
    res.status(500).json({ error: "Failed to fetch pending orders" });
  }
});

// Get customer's current order
router.get("/bar/:barId/customer/:customerName", (req, res) => {
  try {
    const { barId, customerName } = req.params;

    const stmt = db.prepare(`
      SELECT * FROM orders 
      WHERE bar_id = ? AND customer_name = ? AND status IN ('new', 'accepted', 'ready')
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    const order = stmt.get(barId, decodeURIComponent(customerName));

    if (!order) {
      return res.json(null);
    }

    res.json(order);
  } catch (error) {
    console.error("Error fetching customer order:", error);
    res.status(500).json({ error: "Failed to fetch customer order" });
  }
});

// Create new order
router.post("/", (req, res) => {
  try {
    const { barId, customerName, drinkId, drinkTitle } = req.body;

    if (!barId || !customerName || !drinkId || !drinkTitle) {
      return res
        .status(400)
        .json({
          error:
            "Bar ID, customer name, drink ID, and drink title are required",
        });
    }

    // Verify bar exists and get skip_approval setting
    const barStmt = db.prepare("SELECT id, skip_approval FROM bars WHERE id = ?");
    const bar = barStmt.get(barId);

    if (!bar) {
      return res.status(404).json({ error: "Bar not found" });
    }

    // Verify drink exists and is in stock
    const drinkStmt = db.prepare(
      "SELECT * FROM drinks WHERE id = ? AND bar_id = ?"
    );
    const drink = drinkStmt.get(drinkId, barId);

    if (!drink) {
      return res.status(404).json({ error: "Drink not found" });
    }

    if (!drink.in_stock) {
      return res.status(400).json({ error: "Drink is currently out of stock" });
    }

    // Check if customer already has a pending order
    const existingOrderStmt = db.prepare(`
      SELECT id FROM orders 
      WHERE bar_id = ? AND customer_name = ? AND status IN ('new', 'accepted', 'ready')
    `);
    const existingOrder = existingOrderStmt.get(barId, customerName);

    if (existingOrder) {
      return res
        .status(400)
        .json({ error: "Customer already has a pending order" });
    }

    // Determine initial status based on skip_approval setting
    const initialStatus = bar.skip_approval ? 'accepted' : 'new';

    // Create the order
    const stmt = db.prepare(`
      INSERT INTO orders (bar_id, customer_name, drink_id, drink_title, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    const result = stmt.run(
      barId,
      customerName.trim(),
      drinkId,
      drinkTitle.trim(),
      initialStatus
    );

    // Return the created order
    const newOrderStmt = db.prepare("SELECT * FROM orders WHERE id = ?");
    const newOrder = newOrderStmt.get(result.lastInsertRowid);

    // Broadcast to WebSocket clients (will be handled by the main server)
    req.app.locals.wss?.broadcast(barId, {
      type: "new_order",
      order: newOrder,
    });

    res.status(201).json(newOrder);
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// Update order status
router.patch("/:orderId/status", (req, res) => {
  try {
    const orderId = req.params.orderId;
    const { barId, status } = req.body;

    if (!barId || !status) {
      return res.status(400).json({ error: "Bar ID and status are required" });
    }

    const validStatuses = ["new", "accepted", "rejected", "ready", "processed"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    // Verify order exists and belongs to the bar
    const checkStmt = db.prepare(
      "SELECT * FROM orders WHERE id = ? AND bar_id = ?"
    );
    const order = checkStmt.get(orderId, barId);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Validate status transitions
    const currentStatus = order.status;
    const validTransitions = {
      new: ["accepted", "rejected"],
      accepted: ["ready", "rejected"],
      ready: ["processed"],
      rejected: [], // No transitions from rejected
      processed: [], // No transitions from processed
    };

    if (!validTransitions[currentStatus].includes(status)) {
      return res.status(400).json({
        error: `Cannot change status from ${currentStatus} to ${status}`,
      });
    }

    // Update the order
    const stmt = db.prepare(`
      UPDATE orders 
      SET status = ?, updated_at = datetime('now') 
      WHERE id = ? AND bar_id = ?
    `);

    stmt.run(status, orderId, barId);

    // Get updated order
    const updatedOrder = checkStmt.get(orderId, barId);

    // Broadcast to WebSocket clients
    req.app.locals.wss?.broadcast(barId, {
      type: "order_status_updated",
      order: updatedOrder,
    });

    res.json(updatedOrder);
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ error: "Failed to update order status" });
  }
});

// Get orders analytics for a bar
router.get("/bar/:barId/analytics", (req, res) => {
  try {
    const barId = req.params.barId;
    const { days = 7 } = req.query;

    // Total orders
    const totalStmt = db.prepare(
      "SELECT COUNT(*) as total FROM orders WHERE bar_id = ?"
    );
    const totalOrders = totalStmt.get(barId).total;

    // Orders today
    const todayStmt = db.prepare(`
      SELECT COUNT(*) as total 
      FROM orders 
      WHERE bar_id = ? AND date(created_at) = date('now')
    `);
    const ordersToday = todayStmt.get(barId).total;

    // Orders in the last N days
    const recentStmt = db.prepare(`
      SELECT COUNT(*) as total 
      FROM orders 
      WHERE bar_id = ? AND created_at >= datetime('now', '-${days} days')
    `);
    const recentOrders = recentStmt.get(barId).total;

    // Popular drinks
    const popularStmt = db.prepare(`
      SELECT drink_title, COUNT(*) as order_count
      FROM orders 
      WHERE bar_id = ? 
      GROUP BY drink_title 
      ORDER BY order_count DESC 
      LIMIT 5
    `);
    const popularDrinks = popularStmt.all(barId);

    // Peak hours (orders by hour of day)
    const peakHoursStmt = db.prepare(`
      SELECT strftime('%H', created_at) as hour, COUNT(*) as order_count
      FROM orders 
      WHERE bar_id = ? AND created_at >= datetime('now', '-${days} days')
      GROUP BY hour 
      ORDER BY order_count DESC 
      LIMIT 5
    `);
    const peakHours = peakHoursStmt.all(barId).map((row) => ({
      hour: `${row.hour}:00`,
      count: row.order_count,
    }));

    // Order status distribution
    const statusStmt = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM orders 
      WHERE bar_id = ? AND created_at >= datetime('now', '-${days} days')
      GROUP BY status
    `);
    const statusDistribution = statusStmt.all(barId);

    // Average orders per day over the period
    const avgPerDayStmt = db.prepare(`
      SELECT COUNT(*) / CAST(julianday('now') - julianday(MIN(created_at)) AS INTEGER) as avg_per_day
      FROM orders 
      WHERE bar_id = ? AND created_at >= datetime('now', '-${days} days')
    `);
    const avgPerDay = avgPerDayStmt.get(barId)?.avg_per_day || 0;

    res.json({
      totalOrders,
      ordersToday,
      recentOrders,
      popularDrinks,
      peakHours,
      statusDistribution,
      averageOrdersPerDay: Math.round(avgPerDay * 10) / 10, // Round to 1 decimal
      period: `${days} days`,
    });
  } catch (error) {
    console.error("Error fetching orders analytics:", error);
    res.status(500).json({ error: "Failed to fetch orders analytics" });
  }
});

// Delete order (customer cancel or admin cleanup)
router.delete("/:orderId", (req, res) => {
  try {
    const orderId = req.params.orderId;
    const { barId, customerName } = req.body;

    if (!barId) {
      return res.status(400).json({ error: "Bar ID is required" });
    }

    // Verify order exists and belongs to the bar
    const checkStmt = db.prepare(
      "SELECT * FROM orders WHERE id = ? AND bar_id = ?"
    );
    const order = checkStmt.get(orderId, barId);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // If customerName is provided, verify the customer owns this order
    // and can only cancel if order hasn't been processed yet
    if (customerName) {
      if (order.customer_name !== customerName) {
        return res.status(403).json({ error: "You can only cancel your own orders" });
      }
      
      if (order.status === "processed") {
        return res.status(400).json({ 
          error: "You cannot cancel orders that have been completed" 
        });
      }
    }

    // Delete the order
    const stmt = db.prepare("DELETE FROM orders WHERE id = ? AND bar_id = ?");
    const result = stmt.run(orderId, barId);

    if (result.changes === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Broadcast to WebSocket clients
    req.app.locals.wss?.broadcast(barId, {
      type: "order_deleted",
      orderId: parseInt(orderId),
    });

    res.json({ success: true, message: "Order deleted successfully" });
  } catch (error) {
    console.error("Error deleting order:", error);
    res.status(500).json({ error: "Failed to delete order" });
  }
});

export default router;
