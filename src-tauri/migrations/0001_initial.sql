CREATE TABLE organization (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120),
  organization_type TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  logo_path TEXT,
  street TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL DEFAULT '',
  postal_code TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  operating_hours TEXT NOT NULL DEFAULT '',
  locale TEXT NOT NULL DEFAULT 'en-US',
  date_format TEXT NOT NULL DEFAULT 'MMM d, yyyy',
  retention_days INTEGER NOT NULL DEFAULT 30 CHECK(retention_days BETWEEN 1 AND 3650),
  require_verification INTEGER NOT NULL DEFAULT 1 CHECK(require_verification IN (0, 1)),
  allow_anonymous_finders INTEGER NOT NULL DEFAULT 1 CHECK(allow_anonymous_finders IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE organization_locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120),
  street TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL DEFAULT '',
  postal_code TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
  created_at TEXT NOT NULL
);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 80),
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT 'Package',
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  retention_days INTEGER CHECK(retention_days IS NULL OR retention_days BETWEEN 1 AND 3650),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX categories_active_name ON categories(name COLLATE NOCASE) WHERE active = 1;

CREATE TABLE storage_locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120),
  description TEXT NOT NULL DEFAULT '',
  parent_id TEXT REFERENCES storage_locations(id) ON DELETE RESTRICT,
  organization_location_id TEXT REFERENCES organization_locations(id) ON DELETE RESTRICT,
  secure INTEGER NOT NULL DEFAULT 0 CHECK(secure IN (0, 1)),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX storage_locations_parent ON storage_locations(parent_id);

CREATE TABLE found_items (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 160),
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  description TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '',
  brand TEXT NOT NULL DEFAULT '',
  found_at TEXT NOT NULL,
  found_location TEXT NOT NULL DEFAULT '',
  storage_location_id TEXT NOT NULL REFERENCES storage_locations(id) ON DELETE RESTRICT,
  finder_name TEXT NOT NULL DEFAULT '',
  finder_contact TEXT NOT NULL DEFAULT '',
  staff_notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'in_custody' CHECK(status IN ('in_custody', 'returned', 'disposed')),
  retention_days INTEGER CHECK(retention_days IS NULL OR retention_days BETWEEN 1 AND 3650),
  returned_at TEXT,
  disposed_at TEXT,
  disposition_method TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX found_items_status_found_at ON found_items(status, found_at DESC);
CREATE INDEX found_items_category ON found_items(category_id, status);
CREATE INDEX found_items_storage ON found_items(storage_location_id, status);
CREATE INDEX found_items_reference ON found_items(reference);
CREATE INDEX found_items_name ON found_items(name COLLATE NOCASE);

CREATE TABLE item_photos (
  id TEXT PRIMARY KEY,
  found_item_id TEXT NOT NULL REFERENCES found_items(id) ON DELETE CASCADE,
  relative_path TEXT NOT NULL UNIQUE,
  thumbnail_path TEXT,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK(byte_size > 0 AND byte_size <= 15728640),
  created_at TEXT NOT NULL
);
CREATE INDEX item_photos_item ON item_photos(found_item_id);

CREATE TABLE lost_reports (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 160),
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  description TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '',
  brand TEXT NOT NULL DEFAULT '',
  lost_at TEXT NOT NULL,
  last_location TEXT NOT NULL DEFAULT '',
  claimant_name TEXT NOT NULL CHECK(length(trim(claimant_name)) BETWEEN 1 AND 160),
  contact TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'resolved', 'closed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX lost_reports_status_lost_at ON lost_reports(status, lost_at DESC);
CREATE INDEX lost_reports_category ON lost_reports(category_id, status);
CREATE INDEX lost_reports_reference ON lost_reports(reference);

CREATE TABLE match_reviews (
  id TEXT PRIMARY KEY,
  lost_report_id TEXT NOT NULL REFERENCES lost_reports(id) ON DELETE CASCADE,
  found_item_id TEXT NOT NULL REFERENCES found_items(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK(status IN ('suggested', 'dismissed', 'confirmed')),
  score INTEGER NOT NULL CHECK(score BETWEEN 0 AND 100),
  explanation TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  UNIQUE(lost_report_id, found_item_id)
);
CREATE INDEX match_reviews_report ON match_reviews(lost_report_id, status);
CREATE INDEX match_reviews_found ON match_reviews(found_item_id, status);

CREATE TABLE custody_events (
  id TEXT PRIMARY KEY,
  record_type TEXT NOT NULL CHECK(record_type IN ('found_item', 'lost_report')),
  record_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  happened_at TEXT NOT NULL,
  staff_name TEXT NOT NULL DEFAULT '',
  details TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX custody_events_record ON custody_events(record_type, record_id, happened_at DESC);

CREATE TRIGGER custody_events_no_update BEFORE UPDATE ON custody_events
BEGIN SELECT RAISE(ABORT, 'custody events are append-only'); END;
CREATE TRIGGER custody_events_no_delete BEFORE DELETE ON custody_events
BEGIN SELECT RAISE(ABORT, 'custody events are append-only'); END;
