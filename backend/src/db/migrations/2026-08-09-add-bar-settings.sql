-- Migration: three more things a host can set per bar.
--
-- orders_closed     last orders — the bar stops taking new ones, but the
--                   queue still works so what is already in can be served.
-- max_active_orders how many drinks one guest may have on the go.
-- guest_token       the secret in the QR link. Left empty on purpose: an
--                   empty one means the old fixed link, so codes already
--                   printed and stuck to a wall keep working until someone
--                   deliberately rotates it.
ALTER TABLE bars ADD COLUMN orders_closed BOOLEAN DEFAULT 0;
ALTER TABLE bars ADD COLUMN max_active_orders INTEGER DEFAULT 1;
ALTER TABLE bars ADD COLUMN guest_token TEXT;
