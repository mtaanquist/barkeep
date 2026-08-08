import express from "express";
import bcrypt from "bcrypt";
import QRCode from "qrcode";

export default function createBarRoutes({ db, publicUrl = "" }) {
  const router = express.Router();

// Create new bar
router.post("/", async (req, res) => {
  try {
    const {
      name,
      bartenderPassword,
      guestPassword,
      language = "en",
    } = req.body;

    if (!name || !bartenderPassword || !guestPassword) {
      return res
        .status(400)
        .json({
          error: "Name, bartender password, and guest password are required",
        });
    }

    // Validate name length
    if (name.trim().length < 2) {
      return res
        .status(400)
        .json({ error: "Bar name must be at least 2 characters long" });
    }

    // Validate password strength
    if (bartenderPassword.length < 4) {
      return res
        .status(400)
        .json({
          error: "Bartender password must be at least 4 characters long",
        });
    }

    if (guestPassword.length < 3) {
      return res
        .status(400)
        .json({ error: "Guest password must be at least 3 characters long" });
    }

    // Validate language
    const validLanguages = ["en", "da"];
    if (!validLanguages.includes(language)) {
      return res
        .status(400)
        .json({ error: "Invalid language. Supported: en, da" });
    }

    // Check if bar name already exists (optional - you might want to allow duplicate names)
    const existingBarStmt = db.prepare("SELECT id FROM bars WHERE name = ?");
    const existingBar = existingBarStmt.get(name.trim());

    if (existingBar) {
      return res
        .status(409)
        .json({ error: "A bar with this name already exists" });
    }

    const bartenderHash = await bcrypt.hash(bartenderPassword, 12);
    const guestHash = await bcrypt.hash(guestPassword, 12);

    const stmt = db.prepare(`
      INSERT INTO bars (name, bartender_password_hash, guest_password_hash, language, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `);

    const result = stmt.run(name.trim(), bartenderHash, guestHash, language);

    res.status(201).json({
      id: result.lastInsertRowid,
      name: name.trim(),
      language,
      message: "Bar created successfully",
    });
  } catch (error) {
    console.error("Error creating bar:", error);
    res.status(500).json({ error: "Failed to create bar" });
  }
});

// Get bar info (public info only)
router.get("/:id", (req, res) => {
  try {
    const stmt = db.prepare(
      "SELECT id, name, language, skip_approval, created_at FROM bars WHERE id = ?"
    );
    const bar = stmt.get(req.params.id);

    if (!bar) {
      return res.status(404).json({ error: "Bar not found" });
    }

    res.json(bar);
  } catch (error) {
    console.error("Error fetching bar:", error);
    res.status(500).json({ error: "Failed to fetch bar" });
  }
});

// Update bar settings (bartender only)
router.put("/:id", async (req, res) => {
  try {
    const barId = req.params.id;
    const { name, language, newBartenderPassword, newGuestPassword, skipApproval } = req.body;

    // Verify bar exists
    const checkStmt = db.prepare("SELECT * FROM bars WHERE id = ?");
    const bar = checkStmt.get(barId);

    if (!bar) {
      return res.status(404).json({ error: "Bar not found" });
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (name !== undefined) {
      if (name.trim().length < 2) {
        return res
          .status(400)
          .json({ error: "Bar name must be at least 2 characters long" });
      }
      updates.push("name = ?");
      values.push(name.trim());
    }

    if (language !== undefined) {
      const validLanguages = ["en", "da"];
      if (!validLanguages.includes(language)) {
        return res
          .status(400)
          .json({ error: "Invalid language. Supported: en, da" });
      }
      updates.push("language = ?");
      values.push(language);
    }

    if (skipApproval !== undefined) {
      updates.push("skip_approval = ?");
      values.push(skipApproval ? 1 : 0);
    }

    if (newBartenderPassword !== undefined) {
      if (newBartenderPassword.length < 4) {
        return res
          .status(400)
          .json({
            error: "Bartender password must be at least 4 characters long",
          });
      }
      const hash = await bcrypt.hash(newBartenderPassword, 12);
      updates.push("bartender_password_hash = ?");
      values.push(hash);
    }

    if (newGuestPassword !== undefined) {
      if (newGuestPassword.length < 3) {
        return res
          .status(400)
          .json({ error: "Guest password must be at least 3 characters long" });
      }
      const hash = await bcrypt.hash(newGuestPassword, 12);
      updates.push("guest_password_hash = ?");
      values.push(hash);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(barId);

    const stmt = db.prepare(`
      UPDATE bars 
      SET ${updates.join(", ")} 
      WHERE id = ?
    `);

    stmt.run(...values);

    // Return updated bar info (without password hashes)
    const updatedBar = db
      .prepare("SELECT id, name, language, skip_approval, created_at FROM bars WHERE id = ?")
      .get(barId);
    res.json(updatedBar);
  } catch (error) {
    console.error("Error updating bar:", error);
    res.status(500).json({ error: "Failed to update bar" });
  }
});

// Get bar analytics/dashboard data
router.get("/:id/dashboard", (req, res) => {
  try {
    const barId = req.params.id;

    // Verify bar exists
    const barStmt = db.prepare(
      "SELECT id, name, language, skip_approval FROM bars WHERE id = ?"
    );
    const bar = barStmt.get(barId);

    if (!bar) {
      return res.status(404).json({ error: "Bar not found" });
    }

    // Get basic stats
    const drinksCountStmt = db.prepare(
      "SELECT COUNT(*) as total FROM drinks WHERE bar_id = ?"
    );
    const drinksCount = drinksCountStmt.get(barId).total;

    const inStockDrinksStmt = db.prepare(
      "SELECT COUNT(*) as total FROM drinks WHERE bar_id = ? AND in_stock = 1"
    );
    const inStockDrinks = inStockDrinksStmt.get(barId).total;

    const totalOrdersStmt = db.prepare(
      "SELECT COUNT(*) as total FROM orders WHERE bar_id = ?"
    );
    const totalOrders = totalOrdersStmt.get(barId).total;

    const pendingOrdersStmt = db.prepare(`
      SELECT COUNT(*) as total 
      FROM orders 
      WHERE bar_id = ? AND status IN ('new', 'accepted', 'ready')
    `);
    const pendingOrders = pendingOrdersStmt.get(barId).total;

    const todayOrdersStmt = db.prepare(`
      SELECT COUNT(*) as total 
      FROM orders 
      WHERE bar_id = ? AND date(created_at) = date('now')
    `);
    const todayOrders = todayOrdersStmt.get(barId).total;

    // Get recent activity (last 10 orders)
    const recentOrdersStmt = db.prepare(`
      SELECT customer_name, drink_title, status, created_at 
      FROM orders 
      WHERE bar_id = ? 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    const recentOrders = recentOrdersStmt.all(barId);

    res.json({
      bar,
      stats: {
        totalDrinks: drinksCount,
        inStockDrinks,
        outOfStockDrinks: drinksCount - inStockDrinks,
        totalOrders,
        pendingOrders,
        todayOrders,
      },
      recentOrders,
    });
  } catch (error) {
    console.error("Error fetching bar dashboard:", error);
    res.status(500).json({ error: "Failed to fetch bar dashboard" });
  }
});

// Delete bar (careful - this will cascade delete everything!)
router.delete("/:id", (req, res) => {
  try {
    const barId = req.params.id;
    const { confirmationName } = req.body;

    // Get bar info
    const barStmt = db.prepare("SELECT * FROM bars WHERE id = ?");
    const bar = barStmt.get(barId);

    if (!bar) {
      return res.status(404).json({ error: "Bar not found" });
    }

    // Require confirmation by typing the bar name
    if (confirmationName !== bar.name) {
      return res.status(400).json({
        error:
          "Confirmation failed. Please type the exact bar name to confirm deletion.",
      });
    }

    // Delete in order (foreign key constraints)
    // Orders will be deleted automatically due to CASCADE
    // Drinks will be deleted automatically due to CASCADE

    const stmt = db.prepare("DELETE FROM bars WHERE id = ?");
    const result = stmt.run(barId);

    if (result.changes === 0) {
      return res.status(404).json({ error: "Bar not found" });
    }

    res.json({
      success: true,
      message: `Bar "${bar.name}" and all associated data deleted successfully`,
    });
  } catch (error) {
    console.error("Error deleting bar:", error);
    res.status(500).json({ error: "Failed to delete bar" });
  }
});

// List all bars (for development/admin purposes - you might want to remove this in production)
router.get("/", (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const stmt = db.prepare(`
      SELECT id, name, language, skip_approval, created_at 
      FROM bars 
      ORDER BY created_at DESC 
      LIMIT ?
    `);
    const bars = stmt.all(parseInt(limit));

    res.json(bars);
  } catch (error) {
    console.error("Error fetching bars:", error);
    res.status(500).json({ error: "Failed to fetch bars" });
  }
});

// Generate QR code for bar
router.get("/:id/qrcode", async (req, res) => {
  try {
    const barId = req.params.id;

    // Verify bar exists and get guest password
    const stmt = db.prepare("SELECT id, name, guest_password_hash FROM bars WHERE id = ?");
    const bar = stmt.get(barId);

    if (!bar) {
      return res.status(404).json({ error: "Bar not found" });
    }

    // Prefer an explicitly configured public address, otherwise use the host
    // the request arrived on so the QR code points back at this same server.
    const baseUrl = publicUrl || `${req.protocol}://${req.get("host")}`;

    // Create a simple guest access token (base64 encoded bar info)
    // This is not super secure but good enough for a home bar system
    const guestToken = Buffer.from(`${barId}:guest_access`).toString('base64');
    
    // Create the URL that will take users directly to guest access for this bar
    const qrUrl = `${baseUrl}/bar/${barId}?token=${guestToken}`;

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(qrUrl, {
      width: 512,
      margin: 2,
      color: {
        dark: '#1e40af', // Blue color matching the app theme
        light: '#ffffff'
      }
    });

    res.json({
      barId: bar.id,
      barName: bar.name,
      url: qrUrl,
      qrCode: qrCodeDataUrl
    });
  } catch (error) {
    console.error("Error generating QR code:", error);
    res.status(500).json({ error: "Failed to generate QR code" });
  }
});

// Validate guest token and auto-login
router.post("/:id/guest-token-login", async (req, res) => {
  try {
    const barId = req.params.id;
    const { token, customerName } = req.body;

    if (!token || !customerName) {
      return res.status(400).json({ error: "Token and customer name are required" });
    }

    // Validate customer name
    if (customerName.trim().length < 2) {
      return res.status(400).json({ error: "Customer name must be at least 2 characters" });
    }

    // Decode and validate token
    let decodedToken;
    try {
      decodedToken = Buffer.from(token, 'base64').toString('utf-8');
      const [tokenBarId, tokenType] = decodedToken.split(':');
      
      if (tokenBarId !== barId || tokenType !== 'guest_access') {
        throw new Error('Invalid token');
      }
    } catch (err) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // Get bar info
    const stmt = db.prepare("SELECT * FROM bars WHERE id = ?");
    const bar = stmt.get(barId);

    if (!bar) {
      return res.status(404).json({ error: "Bar not found" });
    }

    // Return successful guest authentication
    res.json({
      success: true,
      barId: bar.id,
      barName: bar.name,
      language: bar.language,
      customerName: customerName.trim(),
      userType: "guest",
    });
  } catch (error) {
    console.error("Guest token login error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
});

  return router;
}
