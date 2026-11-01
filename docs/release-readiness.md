# Release readiness

## Current status — 2026-11-01

**PARTIALLY COMPLETE.** Native-backed fixes and expanded coverage have landed in this checkout, but the requested complete walkthrough and visual/accessibility qualification have not been performed. A successful build is not a substitute for desktop qualification.

## Completed in this pass

- Schema version 3 adds structured seven-day operating hours, organization branding, an editable staff attribution label, and legacy-hours preservation.
- Organization setup supports a local logo, an accessible primary color, theme selection, structured Monday–Sunday hours, overnight hours, and review before finish.
- Settings can update appearance, hours, branding, staff attribution, organization identity, and add/archive organization sites.
- Lost reports can be edited and closed/reopened. Match review supports association/removal and rejects stale or competing confirmations. Return validation also prevents bypassing a competing association.
- Found inventory has SQLite-backed date filters and page controls; page/date inputs are validated and page arithmetic is bounded.
- Development-only autofill uses a Vite production alias to a no-op module; its sample data and control are absent from production assets. It only populates forms and never submits.
- Staff attribution is recorded on found/lost changes, match review, storage moves, returns, disposition, and photo events. This is a locally configured label, not authentication or authorization.
- Modal dialogs now have Escape handling, focus containment/restoration, and an accessible name. Some nonfunctional header controls were wired to reports/settings/help.
- SQLite migration 2→3 preserves existing organization fields and prior free-text hours. The upgrade test verifies preservation.

## Qualification evidence

Commands run in this checkout:

- `pnpm build` — passed after the UI and design-checker changes.
- `pnpm test` — 5 tests passed, including seven-day onboarding/theme and non-submitting development autofill checks.
- `cargo test --manifest-path src-tauri/Cargo.toml` — 15 tests passed, 0 failed.
- `pnpm check:design` — completed with 260 heuristic literal-color warnings. This is a review aid, not proof of accessible or correct rendered appearance.
- `pnpm tauri build --bundles deb,rpm` — passed from final sources and generated fresh Debian and RPM artifacts. The packaged executable stayed running for an 8-second startup smoke check with isolated XDG directories.

The host reports X11/Wayland display variables, but no `tauri-driver` was found. The native launch smoke check did not perform a workflow walkthrough or visual inspection. No screenshot comparison, fresh-install walkthrough, restart persistence walkthrough, or 1280×800 / 1440×900 / 1920×1080 / 1024×768 / narrow-window visual inspection has been recorded. Keyboard and accessibility coverage is partial (modal behavior was improved; no axe or full manual audit was run).

## Known outstanding work

- Qualify the packaged native app through setup, item and lost-report workflows, settings, backup/restore, and restart persistence.
- Visually inspect representative window sizes in both light and dark modes. Check Follow System changes, native dialogs, focus, contrast, overflow, and dropdown rendering.
- Complete application-wide semantic token consolidation: the design checker reports 260 heuristic literal-color candidates in current CSS/component source. Some are palette/status/illustration values; each needs review and the static heuristic cannot classify them reliably.
- Add scenario selection and autofill to category, storage, claim/return and additional workflows; current development autofill covers setup and found/lost forms.
- Add full UI/integration coverage for settings and organization-location persistence, photos/logo, inventory filters/pages, competing claims, restore, and restart behavior.
- Lost-report search currently returns a bounded set (up to 250 records); report pagination is not implemented.
- Staff attribution is not authentication. This single-workstation offline release has no staff accounts or role-based authorization. Do not represent the operator label as a security boundary.
- Operating hours support one interval per day; multiple intervals are deferred.
- Workspace plan/task tracking was restored, but the active task could not be checked-completed because this checkout has no Git `HEAD` and the supported fingerprint tool returns `FINGERPRINT_UNAVAILABLE`. Historical plans/tasks were not present in coordinator ledgers and were not duplicated.
- Existing `.git` has no baseline commit and project files appear untracked. No commit was created to satisfy the coordinator.

## Launch and bundles

```sh
pnpm install
pnpm tauri dev
pnpm tauri build --bundles deb,rpm
```

Bundle output directory: `src-tauri/target/release/bundle/` (`deb/` and `rpm/`). Final build generated `Reclaim_0.1.0_amd64.deb` (4,391,238 bytes) and `Reclaim-0.1.0-1.x86_64.rpm` (4,396,943 bytes).
