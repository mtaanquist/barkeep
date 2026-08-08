import express from "express";
import bcrypt from "bcrypt";
import { db } from "../db/index.js";

const router = express.Router();

// Bartender login
router.post("/bartender", async (req, res) => {
  try {
    const { barId, password } = req.body;

    if (!barId || !password) {
      return res
        .status(400)
        .json({ error: "Bar ID and password are required" });
    }

    // Get bar with bartender password hash
    const stmt = db.prepare("SELECT * FROM bars WHERE id = ?");
    const bar = stmt.get(barId);

    if (!bar) {
      return res.status(404).json({ error: "Bar not found" });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, bar.bartender_password_hash);

    if (!isValid) {
      return res.status(401).json({ error: "Invalid password" });
    }

    // Return success with bar info (no password hashes)
    res.json({
      success: true,
      barId: bar.id,
      barName: bar.name,
      language: bar.language,
      userType: "bartender",
    });
  } catch (error) {
    console.error("Bartender auth error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
});

// Guest login
router.post("/guest", async (req, res) => {
  try {
    const { barId, password, customerName } = req.body;

    if (!barId || !password || !customerName) {
      return res
        .status(400)
        .json({ error: "Bar ID, password, and customer name are required" });
    }

    // Validate customer name
    if (customerName.trim().length < 2) {
      return res
        .status(400)
        .json({ error: "Customer name must be at least 2 characters" });
    }

    // Get bar with guest password hash
    const stmt = db.prepare("SELECT * FROM bars WHERE id = ?");
    const bar = stmt.get(barId);

    if (!bar) {
      return res.status(404).json({ error: "Bar not found" });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, bar.guest_password_hash);

    if (!isValid) {
      return res.status(401).json({ error: "Invalid password" });
    }

    // Return success with bar info
    res.json({
      success: true,
      barId: bar.id,
      barName: bar.name,
      language: bar.language,
      customerName: customerName.trim(),
      userType: "guest",
    });
  } catch (error) {
    console.error("Guest auth error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
});

// Verify session (optional - for checking if credentials are still valid)
router.post("/verify", async (req, res) => {
  try {
    const { barId, userType } = req.body;

    if (!barId || !userType) {
      return res
        .status(400)
        .json({ error: "Bar ID and user type are required" });
    }

    // Get bar info
    const stmt = db.prepare("SELECT id, name, language FROM bars WHERE id = ?");
    const bar = stmt.get(barId);

    if (!bar) {
      return res.status(404).json({ error: "Bar not found" });
    }

    res.json({
      success: true,
      barId: bar.id,
      barName: bar.name,
      language: bar.language,
      userType,
    });
  } catch (error) {
    console.error("Session verify error:", error);
    res.status(500).json({ error: "Verification failed" });
  }
});

export default router;
