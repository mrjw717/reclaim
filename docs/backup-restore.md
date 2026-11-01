# Backup and restore

Backups use the `.reclaim.zip` extension and contain `manifest.json`, a consistent SQLite online-backup snapshot, and managed photos. The manifest records format version, schema version, creation time, relative paths, sizes, and SHA-256 hashes. Backup creation checks the completed archive before returning success.

Restore stages files under the app data directory, validates archive structure, supported versions, hashes, SQLite integrity, and foreign keys before changing current data. The UI asks for explicit confirmation and restore replaces the current workspace rather than merging it. A marker and preserved database/photo directories allow startup recovery if replacement is interrupted. Failed in-process restore attempts restore the prior data and reopen the database.

Do not edit archive contents manually. Restore a copy into the same or a compatible Reclaim version. Keep backups outside the application data directory and periodically verify them by restoring to a test installation. Backup encryption is not implemented; protect exported files according to the organization's handling practices.

Recovery tests currently cover malformed/corrupt archives and consistent backup content. Automated fault injection at each filesystem swap boundary remains outstanding.
