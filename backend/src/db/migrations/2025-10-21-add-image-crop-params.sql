-- Migration: Add image crop parameters to drinks table
-- These parameters store the crop/zoom state for drink images
ALTER TABLE drinks ADD COLUMN image_crop_x REAL DEFAULT 0;
ALTER TABLE drinks ADD COLUMN image_crop_y REAL DEFAULT 0;
ALTER TABLE drinks ADD COLUMN image_crop_zoom REAL DEFAULT 1;
