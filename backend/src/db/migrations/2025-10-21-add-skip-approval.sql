-- Migration: Add skip_approval setting to bars
ALTER TABLE bars ADD COLUMN skip_approval BOOLEAN DEFAULT 0;
