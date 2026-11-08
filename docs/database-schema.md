# Database schema

Migrations are in `src-tauri/migrations/`. `PRAGMA user_version` is the schema version; version 2 adds appearance preference, version 3 adds structured operating hours, preserved legacy hours, organization locations, staff attribution, and branding fields, and version 4 adds a partial unique index (`match_reviews_single_confirmation`) that guarantees a found item can carry at most one confirmed claim association at the database level. SQLite foreign-key enforcement is enabled on the connection. WAL is used for normal operation, with a busy timeout and `synchronous=NORMAL`.

## Tables

- `organization`: the installation's organization profile, policy defaults, appearance, brand, logo, structured operating-hours JSON, legacy free-text hours, and staff attribution label.
- `organization_locations`: named physical sites belonging to the organization, with archive state.
- `categories`: stable IDs, descriptions, icons, ordering, active state, optional retention override.
- `storage_locations`: hierarchical storage areas, organization-location association, secure and active flags.
- `found_items`: custody inventory, generated reference, item details, current storage, lifecycle, retention override.
- `item_photos`: managed relative image and thumbnail paths plus MIME type and byte size.
- `lost_reports`: separate claimant reports, contact and last-known details, lifecycle.
- `match_reviews`: per lost-report/found-item review status. A partial unique index on `found_item_id WHERE status='confirmed'` makes a second confirmed claimant for one item impossible at the schema level; adjudication dismisses competing suggestions inside the same transaction, and a database that already contains contradictory confirmed rows fails migration 0004 loudly at startup rather than rewriting match history.
- `custody_events`: append-only operational events with JSON details and timestamp. Triggers reject update and delete.

Foreign keys and indexes protect relationships and common lookup paths. Category and storage records are archived rather than deleted when referenced. The migration is applied transactionally and initial category seeding uses stable IDs and conflict-safe inserts.

## Integrity notes

The application runs `PRAGMA integrity_check` and `PRAGMA foreign_key_check` against staged restore databases. Event history is append-only at the database level, but it is not cryptographically tamper-resistant. Backups retain the database snapshot and managed photos together.
