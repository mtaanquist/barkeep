-- When the operator retires a bar it is marked here rather than removed, so a
-- mistake can be undone. A dated purge later clears anything left past the
-- retention window. NULL means the bar is live.
ALTER TABLE bars ADD COLUMN deleted_at TEXT;
