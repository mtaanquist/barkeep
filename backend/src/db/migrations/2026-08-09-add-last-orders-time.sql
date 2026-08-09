-- Migration: a time for last orders, rather than only a switch.
--
-- Held as a full moment, not a time of day, because a party runs past
-- midnight: "last orders at two" means two tomorrow morning, and a plain
-- HH:MM cannot tell those apart. Empty means nobody has set one.
ALTER TABLE bars ADD COLUMN last_orders_at TEXT;
