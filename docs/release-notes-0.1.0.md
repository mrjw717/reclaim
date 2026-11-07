# Reclaim 0.1.0 — Public Beta Candidate

**Status:** Release candidate; not yet release-qualified.

## Platform

Linux desktop (64-bit x86 packages currently configured for Debian and RPM-based distributions). The AppImage bundle has not been produced. Other platforms are not qualified.

## Included

- Five-step organization onboarding, seven-day hours, Light/Dark/Follow System appearance, accessible brand color, and local logo.
- Local categories, organization sites, site-linked storage areas, secure storage, and nested locations.
- Found-item intake with optional photographs, search/filter/date paging, item editing, custody history, and storage moves.
- Lost reports with edit/close/reopen, ranked match suggestions, competing-claim safeguards, verified returns, and retention review/disposition.
- Local SQLite storage and validated backup/restore.

## Important limitations

- Single-workstation trust model: anyone with access to the workstation can use the application. Staff names are attribution labels, not authentication or enforced roles.
- Data files and backup archives are not encrypted by Reclaim.
- Reclaim does not synchronize workspaces between computers or automatically update itself.
- One operating interval per day; split schedules are not supported.
- Match scores are heuristic and never establish ownership. Staff make the decision.
- Retention deadlines prompt human review and do not encode local legal requirements.
- Disposable-profile native checks demonstrate the main workflows, local photo persistence, and process-restart behavior. Current-source Debian/RPM bundles were rebuilt and passed basic install/start/removal and data-retention checks on 2026-11-02. Desktop-menu launch, version-to-version upgrade, full package GUI workflows, visual/accessibility qualification, and recovery edge cases remain incomplete. See [release qualification](release-readiness.md) before relying on this candidate.

## Installation and upgrade

Use the supplied `.deb` or `.rpm` package for the matching Linux distribution. Verify its SHA-256 checksum against the accompanying `SHA256SUMS` file. Before upgrading, close Reclaim and create a verified backup. Package upgrades preserve the application-data directory and run SQLite migrations on next launch. Automatic updates are not enabled; install each future package manually.
