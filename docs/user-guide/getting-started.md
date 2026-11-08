# Getting Started

Reclaim is a local lost-and-found workspace for one organization on one computer. It does not require an account or network access. Anyone who can use the workstation can use the workspace; staff names are attribution labels, not sign-in credentials.

## Install

For Debian or Ubuntu, install the `.deb` package supplied with the release using the desktop package installer or `sudo apt install ./Reclaim_0.1.0_amd64.deb`. For Fedora or another RPM-based distribution, install the supplied `.rpm` with the system package installer or `sudo dnf install ./Reclaim-0.1.0-1.x86_64.rpm`.

Open **Reclaim** from your desktop application menu. The first launch creates a local SQLite database and the starter item categories.

## Set up your workspace

The five setup steps keep organization details, operating hours, appearance, and operational rules separate. You can go back without losing entered values.

1. **Organization:** enter the organization name, type, phone, and email.
2. **Location & hours:** name the first site, enter its address, then set open or closed and opening and closing times for Monday through Sunday. Use the copy-hours controls for repeated schedules. If the location closes after midnight — for example Friday 8:00 PM to 2:00 AM — mark the day with **Closes next day**; the close time must then be earlier than the open time. Equal opening and closing times are not accepted (for 24-hour service, use 00:00–23:59), and each overnight interval stays attached to its own day.
3. **Branding:** choose Light, Dark, or Follow System, upload an optional PNG, JPEG, or WebP logo up to 2 MB, and choose an accessible primary color.
4. **Preferences:** set the default retention period, whether returns require ownership verification, whether finder details can be omitted, and locale/date format.
5. **Review:** check the summary and open the workspace. Edit these values later in Settings.

## Configure categories and storage

Open **Settings** from the left navigation. Categories can be added, edited, reordered, archived, and restored. Categories already used by records remain available for those records.

Create organization sites under **Settings → Organization**. Create rooms, cabinets, shelves, and secure areas under **Storage**. A storage area can be assigned to an organization site and nested under another storage area. Mark restricted areas as secure; Reclaim then requires staff to record how ownership was verified before completing a return.

## Register the first found item

Choose **Register found item**. Enter an item name, category, date and time, and storage location. Add identifying details, finder/contact information, and staff notes when useful. **Add item photo** opens a native file picker; accepted formats are PNG, JPEG, and WebP, up to 15 MB. Select **Save found item** to create the custody record.

The item appears in Found items with a reference number. Select it to review its details, photographs, storage location, and custody history.

## License and legal information

Reclaim is released under the MIT License, copyright Kynex Media — the full text is included with the packages as the Debian `copyright` file and in the repository as `LICENSE`. Bundled open-source components keep their own licenses; the package includes third-party notices generated from the actual dependency list. Data files and backup archives are not encrypted, so keep workstation and backup storage access limited to trusted people.
