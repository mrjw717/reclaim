# Data and Backups

## Where data is stored

Reclaim stores its SQLite database, organization settings, item photographs, and logo in the operating system's application-data folder. On the qualified Linux development runtime, files were stored in `~/.local/share/com.reclaim.desktop/` even with a separate `XDG_DATA_HOME`. The database file is `reclaim.sqlite3`; managed photographs are stored in the same private data directory. Other Linux desktop/package configurations may use a different OS application-data location; confirm it from your desktop environment before moving or removing files.

The workspace is local to this computer. Reclaim does not encrypt the database or exported backup archives and does not synchronize records to a server. Protect the workstation account and any removable or shared drive that holds backups. A staff attribution name is not an authentication boundary.

## Create a backup

Open **Settings → Data → Backup & restore** and choose **Create a backup**. Save the `.reclaim.zip` file to a protected location outside the application-data folder. A backup includes a consistent SQLite snapshot, managed photographs, a manifest, and integrity hashes. Keep more than one copy when the records matter to daily operations.

## Restore a backup

Open **Settings → Data → Backup & restore**, choose **Restore a workspace**, select the archive, and review the replacement warning. Restore replaces the current workspace; it does not merge records. Reclaim validates the archive before replacement and preserves the previous database and photo directory for recovery if replacement is interrupted. Make a fresh backup before restoring. Test important backups by restoring a copy in an isolated Reclaim data directory.

A corrupt, unsupported, or modified archive should be rejected. Do not edit files inside an archive by hand.

## Application upgrades

Close Reclaim before installing an upgrade. Keep a separate backup before upgrading. Reclaim applies numbered SQLite migrations when the application opens; migrations are additive and retain existing organization records. If the database was created by a newer Reclaim version, an older version refuses to open it. Reinstalling or uninstalling the application package does not intentionally remove the user-data directory; uninstall does not erase private records.

## Privacy and deletion

Records can contain names and contact information. Limit access to the workstation and copies of backup files. To permanently remove local records, first export any records your organization must retain, close Reclaim, then use your operating system's file manager to remove the `com.reclaim.desktop` application-data directory and any exported backups. This permanently deletes the local workspace; confirm the selected path before deleting it. Reclaim currently has no in-app whole-workspace deletion control.
