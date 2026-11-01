ALTER TABLE organization ADD COLUMN theme TEXT NOT NULL DEFAULT 'system' CHECK(theme IN ('light', 'dark', 'system'));
