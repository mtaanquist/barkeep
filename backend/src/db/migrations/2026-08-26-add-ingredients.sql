-- Migration: ingredients the bar keeps, and which drinks use them. Marking one
-- out of stock takes every drink that needs it off the menu at once, instead of
-- the bartender finding and switching off each drink by hand.
CREATE TABLE IF NOT EXISTS ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bar_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    in_stock BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bar_id) REFERENCES bars (id) ON DELETE CASCADE,
    -- One row per name per bar, matched without regard to case so "Campari"
    -- and "campari" cannot both exist.
    UNIQUE(bar_id, name COLLATE NOCASE)
);

CREATE TABLE IF NOT EXISTS drink_ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    drink_id INTEGER NOT NULL,
    ingredient_id INTEGER NOT NULL,
    -- What the recipe says, as written: "3 cl", "1 skive", "top op". Empty
    -- when the recipe does not say how much.
    amount TEXT,
    -- Keeps the recipe's own order, which is the order it is read in.
    position INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (drink_id) REFERENCES drinks (id) ON DELETE CASCADE,
    FOREIGN KEY (ingredient_id) REFERENCES ingredients (id) ON DELETE CASCADE,
    UNIQUE(drink_id, ingredient_id)
);

-- Things done once to what is already in the database, as opposed to changes
-- to its shape. Reading ingredients out of the old recipes is the first.
CREATE TABLE IF NOT EXISTS setup_steps (
    name TEXT PRIMARY KEY,
    done_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ingredients_bar ON ingredients(bar_id, in_stock);
CREATE INDEX IF NOT EXISTS idx_drink_ingredients_drink ON drink_ingredients(drink_id);
CREATE INDEX IF NOT EXISTS idx_drink_ingredients_ingredient ON drink_ingredients(ingredient_id);
