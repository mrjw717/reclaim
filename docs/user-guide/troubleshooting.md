# Troubleshooting

## Reclaim does not start

Check that your Linux distribution provides the package dependencies listed by the installer, including GTK 3 and WebKitGTK 4.1. Restart the computer if a package installation updated those libraries. If the desktop launcher does not appear, log out and back in or start **Reclaim** from a terminal to see startup errors.

## Workspace or database error

Do not delete or replace `reclaim.sqlite3` by hand. Close Reclaim and copy the complete `com.reclaim.desktop` data directory to a safe location before further recovery. If you have a valid backup, try restoring it after preserving the current files. An older application version cannot open a database migrated by a newer version.

## Missing photographs or logo

Photos and logos are stored locally. Confirm that the Reclaim data directory is still present and readable, and check that the disk is not full. Restore a verified backup if files are missing. Do not edit the SQLite database or archive manually.

## Backup is rejected

Use an unmodified `.reclaim.zip` produced by Reclaim and a version that supports its format. Check that the file finished copying and that the destination drive is readable. Keep the current data directory intact while investigating.

## Display or navigation problem

Reopen the window or adjust its size. The supported desktop window minimum is 680 × 680 pixels. At narrow widths, use the Settings gear in the top bar; settings sections remain available in the settings navigation. Reclaim follows Light, Dark, or system appearance as selected in Settings.

## Share diagnostics safely

When contacting your organization’s support contact, provide the Reclaim version, Linux distribution/version, whether the failure happens at startup or during a named action, and the exact error text with names and contact details removed. Do not send the database, backup archive, screenshots containing personal information, or item photographs unless your organization has approved that sharing.
