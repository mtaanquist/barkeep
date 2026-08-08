import express from "express";
import { db } from "../db/index.js";

const router = express.Router();

// Get all categories for a bar
router.get("/bar/:barId", (req, res) => {
  try {
    const barId = req.params.barId;

    const stmt = db.prepare(
      "SELECT * FROM categories WHERE bar_id = ? ORDER BY name ASC"
    );
    const categories = stmt.all(barId);

    res.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// Create a new category
router.post("/", (req, res) => {
  try {
    const { barId, name } = req.body;

    if (!barId || !name) {
      return res.status(400).json({ error: "Bar ID and name are required" });
    }

    // Check if category already exists for this bar
    const existingStmt = db.prepare(
      "SELECT id FROM categories WHERE bar_id = ? AND name = ?"
    );
    const existing = existingStmt.get(barId, name.trim());

    if (existing) {
      return res.status(400).json({ error: "Category already exists" });
    }

    const stmt = db.prepare(
      "INSERT INTO categories (bar_id, name) VALUES (?, ?)"
    );
    const result = stmt.run(barId, name.trim());

    const newCategory = {
      id: result.lastInsertRowid,
      bar_id: barId,
      name: name.trim(),
      created_at: new Date().toISOString(),
    };

    res.status(201).json(newCategory);
  } catch (error) {
    console.error("Error creating category:", error);
    res.status(500).json({ error: "Failed to create category" });
  }
});

// Update a category
router.put("/:id", (req, res) => {
  try {
    const categoryId = req.params.id;
    const { barId, name } = req.body;

    if (!barId || !name) {
      return res.status(400).json({ error: "Bar ID and name are required" });
    }

    // Check if category exists and belongs to the bar
    const checkStmt = db.prepare(
      "SELECT * FROM categories WHERE id = ? AND bar_id = ?"
    );
    const existing = checkStmt.get(categoryId, barId);

    if (!existing) {
      return res.status(404).json({ error: "Category not found" });
    }

    // Check if name would conflict with another category
    const conflictStmt = db.prepare(
      "SELECT id FROM categories WHERE bar_id = ? AND name = ? AND id != ?"
    );
    const conflict = conflictStmt.get(barId, name.trim(), categoryId);

    if (conflict) {
      return res.status(400).json({ error: "Category name already exists" });
    }

    const updateStmt = db.prepare(
      "UPDATE categories SET name = ? WHERE id = ? AND bar_id = ?"
    );
    updateStmt.run(name.trim(), categoryId, barId);

    const updated = {
      ...existing,
      name: name.trim(),
    };

    res.json(updated);
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({ error: "Failed to update category" });
  }
});

// Delete a category
router.delete("/:id", (req, res) => {
  try {
    const categoryId = req.params.id;
    const { barId } = req.body;

    if (!barId) {
      return res.status(400).json({ error: "Bar ID is required" });
    }

    // Check if category exists and belongs to the bar
    const checkStmt = db.prepare(
      "SELECT * FROM categories WHERE id = ? AND bar_id = ?"
    );
    const existing = checkStmt.get(categoryId, barId);

    if (!existing) {
      return res.status(404).json({ error: "Category not found" });
    }

    // Check if any drinks are using this category
    const drinksStmt = db.prepare(
      "SELECT COUNT(*) as count FROM drinks WHERE category_id = ?"
    );
    const { count } = drinksStmt.get(categoryId);

    if (count > 0) {
      return res.status(400).json({ 
        error: `Cannot delete category: ${count} drink(s) are assigned to this category. Please reassign or remove those drinks first.` 
      });
    }

    const deleteStmt = db.prepare(
      "DELETE FROM categories WHERE id = ? AND bar_id = ?"
    );
    deleteStmt.run(categoryId, barId);

    res.json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({ error: "Failed to delete category" });
  }
});

export default router;
