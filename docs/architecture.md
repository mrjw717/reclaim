# Architecture

## Runtime

Reclaim is a Tauri v2 desktop shell with a React 19 and TypeScript frontend built by Vite. Rust owns the SQLite connection, data-directory access, image import and processing, backup archives, and restore. The frontend calls typed Tauri commands through `src/api.ts`; command failures are returned as explicit errors and shown in the interface.

The application is single-organization and supports multiple organization sites and nested storage areas. It is a local single-workstation app without staff accounts, authentication, authorization roles, synchronization, or multi-workstation sharing. Staff attribution is an editable local label and does not prove identity.

## Persistence and startup

The database is `reclaim.sqlite3` under Tauri's OS-resolved application data directory. Photos use managed `photos/` and thumbnail paths below that directory. Startup creates the directory, recovers an interrupted restore when necessary, opens SQLite, enables foreign keys and WAL, and applies versioned migrations.

SQLite is authoritative. Frontend state is a view cache only. Database access is serialized through the managed Rust connection. Domain updates and their custody events use SQLite transactions.

## Decisions

- A single organization row keeps first-run setup straightforward; `organization_locations` allows multiple buildings/branches without SaaS tenancy.
- Stable UUID identifiers back categories, storage locations, items, reports, and events. Human references are generated independently and remain suitable for physical labels.
- Rust owns persistence and filesystem operations. The frontend cannot directly access arbitrary application data files.
- Migrations use `PRAGMA user_version` with ordered SQL migration files and transaction-wrapped schema changes.
- Backups are versioned ZIP containers with a SQLite online-backup snapshot, photos, and SHA-256 manifest entries.
- Match scores are deterministic ranking heuristics and are never treated as ownership evidence.

## Boundaries and limitations

The frontend/native boundary is declared in `src/api.ts` and implemented in `src-tauri/src/lib.rs`. There is no generated schema binding, so changes to Rust command DTOs must be reflected in TypeScript and covered by tests. Staff attribution is the configurable `staff_name` organization setting and is written to operational events. Organization logos are stored locally as validated image data URLs. See `release-readiness.md` for qualification gaps and the security boundary.
