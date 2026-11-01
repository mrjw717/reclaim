# Database schema

Migrations are in `src-tauri/migrations/`. `PRAGMA user_version` is the schema version; version 2 adds appearance preference and version 3 adds structured operating hours, preserved legacy hours, organization locations, staff attribution, and branding fields. SQLite foreign-key enforcement is enabled on the connection. WAL is used for normal operation, with a busy timeout and `synchronous=NORMAL`.

## Tables

- `organization`: the installation's organization profile, policy defaults, appearance, brand, logo, structured operating-hours JSON, legacy free-text hours, and staff attribution label.
- `organization_locations`: named physical sites belonging to the organization, with archive state.
- `categories`: stable IDs, descriptions, icons, ordering, active state, optional retention override.
- `storage_locations`: hierarchical storage areas, organization-location association, secure and active flags.
- `found_items`: custody inventory, generated reference, item details, current storage, lifecycle, retention override.
- `item_photos`: managed relative image and thumbnail paths plus MIME type and byte size.
- `lost_reports`: separate claimant reports, contact and last-known details, lifecycle.
- `match_reviews`: per lost-report/found-item review status.
- `custody_events`: append-only operational events with JSON details and timestamp. Triggers reject update and delete.

Foreign keys and indexes protect relationships and common lookup paths. Category and storage records are archived rather than deleted when referenced. The migration is applied transactionally and initial category seeding uses stable IDs and conflict-safe inserts.

## Integrity notes

The application runs `PRAGMA integrity_check` and `PRAGMA foreign_key_check` against staged restore databases. Event history is append-only at the database level, but it is not cryptographically tamper-resistant. Backups retain the database snapshot and managed photos together.
