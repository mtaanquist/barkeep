import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { db } from "../server.js";

const router = express.Router();

// Configure multer for image uploads (v1.x syntax)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = "./uploads";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const fileExtension = path.extname(file.originalname);
    cb(null, "drink-" + uniqueSuffix + fileExtension);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  },
});

// Get all drinks for a bar
router.get("/bar/:barId", (req, res) => {
  try {
    const barId = req.params.barId;

    const stmt = db.prepare(`
      SELECT d.*, c.name as category_name 
      FROM drinks d 
      LEFT JOIN categories c ON d.category_id = c.id 
      WHERE d.bar_id = ? 
      ORDER BY d.created_at DESC
    `);
    const drinks = stmt.all(barId);

    res.json(drinks);
  } catch (error) {
    console.error("Error fetching drinks:", error);
    res.status(500).json({ error: "Failed to fetch drinks" });
  }
});

// Get drinks for guests (filtered based on guest settings)
router.get("/bar/:barId/guest", (req, res) => {
  try {
    const barId = req.params.barId;

    const stmt = db.prepare(`
      SELECT d.*, c.name as category_name 
      FROM drinks d 
      LEFT JOIN categories c ON d.category_id = c.id 
      WHERE d.bar_id = ? 
      ORDER BY d.created_at DESC
    `);
    const drinks = stmt.all(barId);

    // Filter drinks for guest access
    const guestDrinks = drinks.map(drink => {
      if (!drink.show_recipe_to_guests) {
        // Hide recipe from guests if not allowed
        return {
          ...drink,
          recipe: null // Don't show recipe to guests
        };
      }
      return drink; // Show full drink including recipe
    });

    res.json(guestDrinks);
  } catch (error) {
    console.error("Error fetching drinks for guests:", error);
    res.status(500).json({ error: "Failed to fetch drinks" });
  }
});

// Get single drink
router.get("/bar/:barId/drink/:drinkId", (req, res) => {
  try {
    const { barId, drinkId } = req.params;

    const stmt = db.prepare("SELECT * FROM drinks WHERE id = ? AND bar_id = ?");
    const drink = stmt.get(drinkId, barId);

    if (!drink) {
      return res.status(404).json({ error: "Drink not found" });
    }

    res.json(drink);
  } catch (error) {
    console.error("Error fetching drink:", error);
    res.status(500).json({ error: "Failed to fetch drink" });
  }
});

// Upload image endpoint
router.post("/upload-image", upload.single("image"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" });
    }

    // Return the URL path for the uploaded image
    const imageUrl = `/uploads/${req.file.filename}`;

    res.json({
      success: true,
      imageUrl: imageUrl,
      filename: req.file.filename,
    });
  } catch (error) {
    console.error("Image upload error:", error);
    res.status(500).json({ error: "Failed to upload image" });
  }
});

// Create new drink
router.post("/", (req, res) => {
  try {
    const { barId, title, imageUrl, recipe, baseSpirit, guestDescription, showRecipeToGuests, categoryId } = req.body;

    if (!barId || !title || !recipe) {
      return res
        .status(400)
        .json({ error: "Bar ID, title, and recipe are required" });
    }

    // Verify bar exists
    const barStmt = db.prepare("SELECT id FROM bars WHERE id = ?");
    const bar = barStmt.get(barId);

    if (!bar) {
      return res.status(404).json({ error: "Bar not found" });
    }

    // Verify category exists if provided
    if (categoryId) {
      const categoryStmt = db.prepare("SELECT id FROM categories WHERE id = ? AND bar_id = ?");
      const category = categoryStmt.get(categoryId, barId);
      
      if (!category) {
        return res.status(400).json({ error: "Category not found" });
      }
    }

    const stmt = db.prepare(`
      INSERT INTO drinks (bar_id, title, image_url, recipe, in_stock, base_spirit, guest_description, show_recipe_to_guests, category_id)
      VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      barId,
      title.trim(),
      imageUrl || null,
      recipe.trim(),
      baseSpirit || null,
      guestDescription || null,
      showRecipeToGuests ? 1 : 0,
      categoryId || null
    );

    // Return the created drink
    const newDrinkStmt = db.prepare("SELECT * FROM drinks WHERE id = ?");
    const newDrink = newDrinkStmt.get(result.lastInsertRowid);

    res.status(201).json(newDrink);
  } catch (error) {
    console.error("Error creating drink:", error);
    res.status(500).json({ error: "Failed to create drink" });
  }
});

// Update drink
router.put("/:drinkId", (req, res) => {
  try {
    const drinkId = req.params.drinkId;
    const { barId, title, imageUrl, recipe, inStock, baseSpirit, guestDescription, showRecipeToGuests, categoryId } = req.body;

    if (!barId) {
      return res.status(400).json({ error: "Bar ID is required" });
    }

    // Verify drink exists and belongs to the bar
    const checkStmt = db.prepare(
      "SELECT * FROM drinks WHERE id = ? AND bar_id = ?"
    );
    const existingDrink = checkStmt.get(drinkId, barId);

    if (!existingDrink) {
      return res.status(404).json({ error: "Drink not found" });
    }

    // Verify category exists if provided
    if (categoryId) {
      const categoryStmt = db.prepare("SELECT id FROM categories WHERE id = ? AND bar_id = ?");
      const category = categoryStmt.get(categoryId, barId);
      
      if (!category) {
        return res.status(400).json({ error: "Category not found" });
      }
    }

    // Build update query dynamically based on provided fields
    const updates = [];
    const values = [];

    if (title !== undefined) {
      updates.push("title = ?");
      values.push(title.trim());
    }
    if (imageUrl !== undefined) {
      updates.push("image_url = ?");
      values.push(imageUrl || null);
    }
    if (recipe !== undefined) {
      updates.push("recipe = ?");
      values.push(recipe.trim());
    }
    if (inStock !== undefined) {
      updates.push("in_stock = ?");
      values.push(inStock ? 1 : 0);
    }
    if (baseSpirit !== undefined) {
      updates.push("base_spirit = ?");
      values.push(baseSpirit || null);
    }
    if (guestDescription !== undefined) {
      updates.push("guest_description = ?");
      values.push(guestDescription || null);
    }
    if (showRecipeToGuests !== undefined) {
      updates.push("show_recipe_to_guests = ?");
      values.push(showRecipeToGuests ? 1 : 0);
    }
    if (categoryId !== undefined) {
      updates.push("category_id = ?");
      values.push(categoryId || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(drinkId, barId);

    const stmt = db.prepare(`
      UPDATE drinks 
      SET ${updates.join(", ")} 
      WHERE id = ? AND bar_id = ?
    `);

    stmt.run(...values);

    // Return updated drink
    const updatedDrink = checkStmt.get(drinkId, barId);
    res.json(updatedDrink);
  } catch (error) {
    console.error("Error updating drink:", error);
    res.status(500).json({ error: "Failed to update drink" });
  }
});

// Toggle drink stock status
router.patch("/:drinkId/stock", (req, res) => {
  try {
    const drinkId = req.params.drinkId;
    const { barId } = req.body;

    if (!barId) {
      return res.status(400).json({ error: "Bar ID is required" });
    }

    // Get current stock status
    const checkStmt = db.prepare(
      "SELECT * FROM drinks WHERE id = ? AND bar_id = ?"
    );
    const drink = checkStmt.get(drinkId, barId);

    if (!drink) {
      return res.status(404).json({ error: "Drink not found" });
    }

    // Toggle stock status
    const newStockStatus = drink.in_stock ? 0 : 1;

    const stmt = db.prepare(
      "UPDATE drinks SET in_stock = ? WHERE id = ? AND bar_id = ?"
    );
    stmt.run(newStockStatus, drinkId, barId);

    // Return updated drink
    const updatedDrink = checkStmt.get(drinkId, barId);
    res.json(updatedDrink);
  } catch (error) {
    console.error("Error toggling stock:", error);
    res.status(500).json({ error: "Failed to toggle stock status" });
  }
});

// Delete drink
router.delete("/:drinkId", (req, res) => {
  try {
    const drinkId = req.params.drinkId;
    const { barId } = req.body;

    if (!barId) {
      return res.status(400).json({ error: "Bar ID is required" });
    }

    // Verify drink exists and belongs to the bar
    const checkStmt = db.prepare(
      "SELECT * FROM drinks WHERE id = ? AND bar_id = ?"
    );
    const drink = checkStmt.get(drinkId, barId);

    if (!drink) {
      return res.status(404).json({ error: "Drink not found" });
    }

    // Delete associated image file if it exists
    if (drink.image_url && drink.image_url.startsWith("/uploads/")) {
      const imagePath = "." + drink.image_url;
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    // Delete the drink
    const stmt = db.prepare("DELETE FROM drinks WHERE id = ? AND bar_id = ?");
    const result = stmt.run(drinkId, barId);

    if (result.changes === 0) {
      return res.status(404).json({ error: "Drink not found" });
    }

    res.json({ success: true, message: "Drink deleted successfully" });
  } catch (error) {
    console.error("Error deleting drink:", error);
    res.status(500).json({ error: "Failed to delete drink" });
  }
});

// Get drinks analytics for a bar
router.get("/bar/:barId/analytics", (req, res) => {
  try {
    const barId = req.params.barId;

    // Get popular drinks based on order history
    const popularStmt = db.prepare(`
      SELECT drink_title, COUNT(*) as order_count
      FROM orders 
      WHERE bar_id = ? 
      GROUP BY drink_title 
      ORDER BY order_count DESC 
      LIMIT 10
    `);
    const popularDrinks = popularStmt.all(barId);

    // Get total drinks count
    const totalStmt = db.prepare(
      "SELECT COUNT(*) as total FROM drinks WHERE bar_id = ?"
    );
    const totalDrinks = totalStmt.get(barId).total;

    // Get in-stock drinks count
    const inStockStmt = db.prepare(
      "SELECT COUNT(*) as total FROM drinks WHERE bar_id = ? AND in_stock = 1"
    );
    const inStockDrinks = inStockStmt.get(barId).total;

    res.json({
      popularDrinks,
      totalDrinks,
      inStockDrinks,
      outOfStockDrinks: totalDrinks - inStockDrinks,
    });
  } catch (error) {
    console.error("Error fetching drinks analytics:", error);
    res.status(500).json({ error: "Failed to fetch drinks analytics" });
  }
});

// Get user's favourite drinks
router.get("/bar/:barId/favourites/:customerName", (req, res) => {
  try {
    const { barId, customerName } = req.params;

    const stmt = db.prepare(`
      SELECT d.*, 
             c.name as category_name,
             uf.created_at as favourited_at,
             1 as is_favourite
      FROM drinks d
      LEFT JOIN categories c ON d.category_id = c.id
      INNER JOIN user_favourites uf ON d.id = uf.drink_id
      WHERE uf.bar_id = ? AND uf.customer_name = ? AND d.in_stock = 1
      ORDER BY uf.created_at DESC
    `);
    const favourites = stmt.all(barId, customerName);

    // Filter drinks for guest access
    const guestFavourites = favourites.map(drink => {
      if (!drink.show_recipe_to_guests) {
        // Hide recipe from guests if not allowed
        return {
          ...drink,
          recipe: null // Don't show recipe to guests
        };
      }
      return drink; // Show full drink including recipe
    });

    res.json(guestFavourites);
  } catch (error) {
    console.error("Error fetching user favourites:", error);
    res.status(500).json({ error: "Failed to fetch favourites" });
  }
});

// Add drink to user's favourites
router.post("/bar/:barId/favourites", (req, res) => {
  try {
    const { barId } = req.params;
    const { customerName, drinkId } = req.body;

    if (!customerName || !drinkId) {
      return res.status(400).json({ error: "Customer name and drink ID are required" });
    }

    // Verify drink exists and belongs to the bar
    const drinkStmt = db.prepare("SELECT * FROM drinks WHERE id = ? AND bar_id = ?");
    const drink = drinkStmt.get(drinkId, barId);

    if (!drink) {
      return res.status(404).json({ error: "Drink not found" });
    }

    // Add to favourites (will ignore if already exists due to UNIQUE constraint)
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO user_favourites (bar_id, customer_name, drink_id)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(barId, customerName, drinkId);

    if (result.changes === 0) {
      return res.status(409).json({ error: "Drink already in favourites" });
    }

    res.status(201).json({ success: true, message: "Drink added to favourites" });
  } catch (error) {
    console.error("Error adding to favourites:", error);
    res.status(500).json({ error: "Failed to add to favourites" });
  }
});

// Remove drink from user's favourites
router.delete("/bar/:barId/favourites", (req, res) => {
  try {
    const { barId } = req.params;
    const { customerName, drinkId } = req.body;

    if (!customerName || !drinkId) {
      return res.status(400).json({ error: "Customer name and drink ID are required" });
    }

    const stmt = db.prepare(`
      DELETE FROM user_favourites 
      WHERE bar_id = ? AND customer_name = ? AND drink_id = ?
    `);
    const result = stmt.run(barId, customerName, drinkId);

    if (result.changes === 0) {
      return res.status(404).json({ error: "Favourite not found" });
    }

    res.json({ success: true, message: "Drink removed from favourites" });
  } catch (error) {
    console.error("Error removing from favourites:", error);
    res.status(500).json({ error: "Failed to remove from favourites" });
  }
});

// Get drinks with favourite status for a customer
router.get("/bar/:barId/guest/:customerName", (req, res) => {
  try {
    const { barId, customerName } = req.params;

    const stmt = db.prepare(`
      SELECT d.*, 
             c.name as category_name,
             CASE WHEN uf.drink_id IS NOT NULL THEN 1 ELSE 0 END as is_favourite
      FROM drinks d
      LEFT JOIN categories c ON d.category_id = c.id
      LEFT JOIN user_favourites uf ON d.id = uf.drink_id 
                                   AND uf.bar_id = d.bar_id 
                                   AND uf.customer_name = ?
      WHERE d.bar_id = ?
      ORDER BY d.created_at DESC
    `);
    const drinks = stmt.all(customerName, barId);

    // Filter drinks for guest access
    const guestDrinks = drinks.map(drink => {
      if (!drink.show_recipe_to_guests) {
        // Hide recipe from guests if not allowed
        return {
          ...drink,
          recipe: null // Don't show recipe to guests
        };
      }
      return drink; // Show full drink including recipe
    });

    res.json(guestDrinks);
  } catch (error) {
    console.error("Error fetching drinks for guest with favourites:", error);
    res.status(500).json({ error: "Failed to fetch drinks" });
  }
});

export default router;
