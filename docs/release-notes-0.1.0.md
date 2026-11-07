# Reclaim 0.1.0 — Public Beta Candidate

**Status:** Release candidate qualified through 2026-11-07; publication awaits owner authorization. See [release qualification](release-readiness.md) for the evidence matrix and remaining gates.

## License

Reclaim is released under the MIT License, copyright Kynex Media. See [LICENSE](../LICENSE). Bundled open-source components keep their own licenses — see [THIRD_PARTY_NOTICES](../THIRD_PARTY_NOTICES.md). Packages carry the license text (RPM `License: MIT` tag; Debian `copyright` and notices files).

## Platform

Linux desktop (64-bit x86). Qualified artifacts: Debian (` .deb`) and RPM packages, install/launch/upgrade/removal tested in disposable containers. An AppImage builds and runs on its build baseline (glibc 2.43) but is not portable to older distributions; it is not a qualified distribution artifact for this beta. Other platforms are not qualified.

## Included

- Five-step organization onboarding, seven-day hours, Light/Dark/Follow System appearance, accessible brand color, and local logo.
- Local categories, organization sites, site-linked storage areas, secure storage, and nested locations.
- Found-item intake with optional photographs, search/filter/date paging, item editing, custody history, and storage moves.
- Lost reports with edit/close/reopen, ranked match suggestions, competing-claim safeguards with a native confirmation, verified returns, and retention review/disposition.
- Local SQLite storage and validated backup/restore (corrupt archives are rejected with prior data intact).
- Accessibility: axe-core clean across rendered screens and themes, keyboard-operable drawer/dialogs with focus containment and restoration, WCAG-checked text and brand-color contrast in light and dark themes.

## Important limitations

- Single-workstation trust model: anyone with access to the workstation can use the application. Staff names are attribution labels, not authentication or enforced roles.
- Data files and backup archives are not encrypted by Reclaim.
- Reclaim does not synchronize workspaces between computers or automatically update itself.
- One operating interval per day; split schedules are not supported.
- Match scores are heuristic and never establish ownership. Staff make the decision.
- Retention deadlines prompt human review and do not encode local legal requirements.
- The AppImage is not portable across distributions (glibc baseline); use the `.deb` or `.rpm`.
- A screen-reader pass has not been performed; keyboard and automated accessibility coverage are complete but do not substitute for assistive-technology testing.

## Installation and upgrade

Use the supplied `.deb` or `.rpm` package for the matching Linux distribution. Verify its SHA-256 checksum against the accompanying `SHA256SUMS` file. Before upgrading, close Reclaim and create a verified backup. Package upgrades preserve the application-data directory and run SQLite migrations on next launch (upgrade-with-data verified on Debian 13). Automatic updates are not enabled; install each future package manually. Uninstalling the package leaves your records and photos in the app-data directory.
