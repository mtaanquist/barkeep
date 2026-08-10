-- Migration: guest accounts — let a regular claim their name for a bar with a
-- password. Favourites and past orders stay keyed by the name, so nothing that
-- already exists moves; this only adds an optional lock on a name.
CREATE TABLE IF NOT EXISTS guest_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bar_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bar_id) REFERENCES bars (id) ON DELETE CASCADE,
    -- One claim per name per bar, matched without regard to case so "Ada" and
    -- "ada" can't be claimed twice.
    UNIQUE(bar_id, name COLLATE NOCASE)
);
