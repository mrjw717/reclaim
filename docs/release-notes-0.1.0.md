# Reclaim 0.1.0 — Public Beta Candidate

**Status:** Release candidate. Published as `v0.1.0-rc.1` on 2026-11-10 by owner instruction. See [release qualification](release-readiness.md) for the evidence matrix and recorded limitations.

## License

Reclaim is released under the MIT License, copyright Kynex Media. See [LICENSE](../LICENSE). Bundled open-source components keep their own licenses — see [THIRD_PARTY_NOTICES](../THIRD_PARTY_NOTICES.md). Packages carry the license text (RPM `License: MIT` tag; Debian `copyright` and notices files).

## Platform

Linux desktop (64-bit x86). Qualified artifacts for this beta: Debian (`.deb`) and RPM packages, install/launch/removal and data-retention tested in disposable Debian 13 and Fedora 44 containers on the exact release bytes. Distribution scope is intentionally limited to these two package formats: an AppImage builds and runs on its build baseline (glibc 2.43) but is not portable to older distributions, and publication is deferred by owner decision until an older-baseline build environment is chosen.

**Windows:** the codebase compiles for Windows (`x86_64-pc-windows-gnu` cargo check passes) and an executable was produced and launched under Wine, failing only at the missing WebView2 runtime. Release-tag Windows installers (NSIS) are built automatically by GitHub Actions on `windows-latest` — Tauri's supported Windows bundling environment — and attached to the release. Windows has not yet been hardware-tested; treat it as part of the release candidate.

## Included

- Five-step organization onboarding, seven-day hours with explicit overnight intervals (for example Friday 8:00 PM–2:00 AM), Light/Dark/Follow System appearance, accessible brand color, and local logo.
- Local categories, organization sites, site-linked storage areas, secure storage, and nested locations.
- Found-item intake with optional photographs, search/filter/date paging, item editing, custody history, and storage moves.
- Lost reports with edit/close/reopen, ranked match suggestions, competing-claim safeguards with a native confirmation, single-confirmation claim integrity enforced by the database schema, verified returns, and retention review/disposition.
- Local SQLite storage and validated backup/restore (corrupt archives are rejected with prior data intact).
- Accessibility: axe-core clean across rendered screens and themes, keyboard-operable drawer/dialogs with focus containment and restoration, WCAG-checked text and brand-color contrast in light and dark themes.

## Important limitations

- Single-workstation trust model: anyone with access to the workstation can use the application. Staff names are attribution labels, not authentication or enforced roles.
- Data files and backup archives are not encrypted by Reclaim.
- Reclaim does not synchronize workspaces between computers or automatically update itself.
- One operating interval per day; split schedules are not supported. An interval that crosses midnight must be marked "Closes next day", and equal opening/closing times are rejected (for 24-hour service, use 00:00–23:59).
- Match scores are heuristic and never establish ownership. Staff make the decision.
- Retention deadlines prompt human review and do not encode local legal requirements.
- Distribution scope for this beta is intentionally limited to the Debian and RPM packages. An AppImage builds but bundles libraries requiring a newer glibc than long-term distributions ship, so AppImage publication is deferred until an older-baseline build environment is chosen; this is a distribution decision, not a packaging defect.
- Screen-reader status: a real Orca 48.1 review across the essential workflows passed, with one repaired defect (day-specific names for hours checkboxes). Two announcement gaps remain on this platform stack and are recorded as known limitations: ARIA live-region messages (the role=alert validation message and the role=status save toast) and the native confirm dialog were visible and correctly marked up but were not spoken by Orca 48.1 under WebKitGTK/AT-SPI in the qualification environment. Keyboard and automated accessibility coverage are complete.

## Installation and upgrade

Use the supplied `.deb` or `.rpm` package for the matching Linux distribution. Verify the SHA-256 checksum against the accompanying `SHA256SUMS` file (release bytes built from commit `3903635`: `.deb` 4,511,154 bytes / `2b56f6366c1d18ff…323ed410c`; `.rpm` 4,602,791 bytes / `ed60b20f45af…9ce95abd`). Before upgrading, close Reclaim and create a verified backup. Package upgrades preserve the application-data directory and run SQLite migrations on next launch (upgrade-with-data verified on Debian 13; migration 0004 adds a claim-integrity guarantee). Automatic updates are not enabled; install each future package manually. Uninstalling the package leaves your records and photos in the app-data directory.
