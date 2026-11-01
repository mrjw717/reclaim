# Reclaim 0.1.0 release qualification

**Qualification date:** 2026-11-01
**Target:** Linux desktop public beta
**Verdict:** **NOT RELEASE-READY**

The core workflows now run in the actual Tauri desktop app, including a complete first-run setup, found and lost records, competing-claim adjudication, return verification, archive backup/restore, and process-restart persistence. The RC is not qualified for public distribution yet: the new byte-based photo import has not been completed manually after its security change, visual/accessibility coverage is incomplete, and no project license has been selected or included.

## Qualification matrix

| Requirement | Status | Evidence and method | Task | Outstanding findings |
|---|---|---|---|---|
| Repository baseline and workspace recovery | Pass with caveat | New repository had no objects, remote, or prior history; baseline commit `65050e42b1ebdc5837b88319ee815b76c47859f5`; workspace identity and existing umbrella records preserved | Release plan | Existing checkout's prior agent exclusivity could not be established |
| Workspace task finalization | Blocked | Workspace identity was verified; cooperative continuation returned `CHECKOUT_IN_USE` because a prior attempt remains active | Recovery task `e81ee773-7745-4bdb-85e8-7472d7337572` | Preserve the old attempt and quarantine; coordinator would not allow claiming/submitting another task in this checkout |
| Five-step onboarding and seven-day hours | Pass | Actual Tauri window; completed all five steps, inspected review, went backward and confirmed values retained; saved and queried all seven-day JSON | `a73ac311-bfdb-4cfd-8c16-8ac5d8ee6c9e` | All theme/window combinations not yet inspected |
| Theme and logo persistence | Pass, partial | Actual Tauri app; Follow System, brand `#285c4b`, logo; restart DB query confirmed saved data | `86a6c7ee-2c4c-4813-a11d-b77fa0aeb2e5` | Full theme contrast and screenshots by all sizes remain incomplete |
| Found item, photo, inventory | Partial | Native item form saved one found item and image through the earlier path; list, filters and pagination rendered; DB confirmed photo and record. Final packaged app's chooser could be opened, but selection through the new byte-based upload path was not completed | `a96a6907-8a52-42b5-b86f-3d24aa1196c3` | Re-run a native upload through the final byte-based path; broad search/date/filter cases not exercised |
| Lost reports and matching | Pass, partial | Two native lost reports; one matching suggestion reviewed | `a96a6907-8a52-42b5-b86f-3d24aa1196c3` | Edit/close/reopen flows not all manually exercised |
| Competing claims | Pass | Native match review showed both claims; selected Morgan; SQLite showed selected confirmed, Taylor dismissed, history events attributed | `a96a6907-8a52-42b5-b86f-3d24aa1196c3` | More adjudication edge cases remain |
| Return and custody history | Pass | Native return required item-description verification and note; item became returned; history attributed to Desk staff | `a96a6907-8a52-42b5-b86f-3d24aa1196c3` | Retention/disposition not walked through in desktop UI |
| Storage-site linkage/editing | Not qualified | UI controls implemented | `a96a6907-8a52-42b5-b86f-3d24aa1196c3` | Native persistence and site linkage not exercised end to end |
| Database and restart persistence | Pass, partial | Closed native process and reopened it using disposable HOME; integrity check `ok`; organization, theme, color, logo, item, photo, two reports, claim, and custody events persisted | `9f09454f-0c45-4f25-b815-d673105c518c` | Upgrade from a prior packaged install not tested |
| Backup creation | Pass | Native Rust-owned save dialog exported an archive; `unzip -t` passed; archive contains database, full photo, thumbnail, and manifest | `9f09454f-0c45-4f25-b815-d673105c518c` | GTK emitted a widget warning on dialog close; qualify on a second Linux desktop environment |
| Restore and corrupt archive recovery | Pass, partial | Native Rust-owned open dialog restored the archive into a disposable profile after a sentinel change; SQLite integrity `ok`; Rust recovery/corruption tests pass | `9f09454f-0c45-4f25-b815-d673105c518c` | Corrupt-archive rejection not repeated through final native UI |
| Filesystem command boundary | Pass, partial | Photo command accepts validated image bytes; backup commands own native dialogs; webview open/save permissions removed | `9f09454f-0c45-4f25-b815-d673105c518c` | Review dialogs in packaged release |
| Design tokens | Pass | `pnpm check:design` passes without unapproved literals; see `docs/design-system.md` | `862fb495-cc70-4b66-a032-a4f519c8765f` | Static check cannot verify rendered contrast/layout |
| Narrow Settings access | Pass | Actual Tauri app resized to 680×768; header Settings control opened Settings and Data section remained reachable | `862fb495-cc70-4b66-a032-a4f519c8765f` | Remaining requested viewport matrix is incomplete |
| Visual qualification | Partial | Actual screenshots inspected at 680×768 and 1440×920 (dark/system mode) | `862fb495-cc70-4b66-a032-a4f519c8765f` | Light, dark, system and 1024×768, 1280×800, 1920×1080 checks incomplete; small text noted |
| Accessibility | Partial | Settings and form controls exposed names through AT-SPI; modal focus handling and accessible dialog naming implemented | `862fb495-cc70-4b66-a032-a4f519c8765f` | No screen reader session, automated axe scan, full keyboard audit, contrast matrix, or dropdown/dialog keyboard sweep |
| Automated tests | Pass, partial | Frontend 7 tests, Rust 21 tests, frontend build and design check passed; production bundle omits development Autofill labels | `a96a6907-8a52-42b5-b86f-3d24aa1196c3`, `9f09454f-0c45-4f25-b815-d673105c518c` | Native test after final photo-byte path remains open |
| Debian/RPM packaging | Pass, partial | Fresh final-source packages; Debian metadata/desktop entry and RPM name/version/release/license/architecture inspected | `a0ab3051-b711-4bb3-b755-3e0d7f11afa8` | Both report no license metadata |
| Clean install/uninstall | Pass, container scope | Debian stable and Fedora 44 containers installed the final packages, started Reclaim under Xvfb, initialized 17 starter categories with SQLite integrity `ok`, then removed the package while preserving user data | `a0ab3051-b711-4bb3-b755-3e0d7f11afa8` | Package GUI flow tested in Xvfb only; full package walkthrough is from the dev build |
| AppImage | Deferred | One 90-second bounded build attempt timed out during a repeated optimized Rust compile before bundling; host lacks `appimagetool` and `linuxdeploy` | `a0ab3051-b711-4bb3-b755-3e0d7f11afa8` | Use a supported CI/build image with Tauri's Linux deployment toolchain; no AppImage produced |
| User docs and release notes | Pass, partial | `docs/user-guide/` and `docs/release-notes-0.1.0.md` created and reconciled against observed behavior | `c7514281-350a-4f88-8e1e-02fa298b54c6` | Copy review after license decision |
| License and inclusion | Fail | Debian and RPM report no license metadata; no license file exists | `a0ab3051-b711-4bb3-b755-3e0d7f11afa8` | Owner must choose terms; none were inferred |
| Updater readiness | Deferred | No endpoint or signing key configured; signed updater artifacts are required | `a0ab3051-b711-4bb3-b755-3e0d7f11afa8` | Manual package updates documented; automate after key custody and HTTPS endpoint are established |

## Native evidence

The actual desktop binary was built and launched with an isolated temporary HOME. Screenshots are kept outside the repository under `/tmp/reclaim-*.png` and were inspected directly: onboarding review and theme states, found-item inventory, item detail, competing-claim review, narrow Settings, and a 1440×920 dashboard after restart. Test data uses the organization `rc1 qa center`, fictitious claimant names, and `.test` contact data.

The saved backup archive was `/tmp/reclaim-rc1-native-2026-11-01/roundtrip.reclaim.zip.zip` and passed `unzip -t`. It contained `database.sqlite3`, one original photo, one thumbnail, and `manifest.json`. A second disposable profile was changed to `restore sentinel 2`; restoring replaced it with `rc1 qa center`, restored the photo and custody/report records, and passed SQLite `PRAGMA integrity_check`.

## Workspace coordination records

| Plan | Workspace ID | Tasks |
|---|---|---|
| Product Functional Closure | `3f7bc91e-0c08-4b13-8ad9-fa0a26a612f9` | `a73ac311-bfdb-4cfd-8c16-8ac5d8ee6c9e`, `86a6c7ee-2c4c-4813-a11d-b77fa0aeb2e5`, `a96a6907-8a52-42b5-b86f-3d24aa1196c3`, `a0c97713-40e9-41e9-a8d1-a070648e7806` |
| Native Persistence & Reliability | `d9e9dea5-79ec-4748-9569-fb620b96845f` | `9f09454f-0c45-4f25-b815-d673105c518c` |
| Visual, Accessibility & Desktop Qualification | `9a1ed983-7bc5-47fd-a4eb-8630db1b66c8` | `862fb495-cc70-4b66-a032-a4f519c8765f` |
| Release Engineering & Distribution | `dc79e915-5c25-4903-ab6e-d8c459f0beef` | `a0ab3051-b711-4bb3-b755-3e0d7f11afa8`, `c7514281-350a-4f88-8e1e-02fa298b54c6` |

The workspace identity is `df124e5b-db72-41d0-8ec8-10ba2574e5cb`; the checkout is `fa053679-8474-411d-af4f-c38a473a6f79`. The prior recovery task `e81ee773-7745-4bdb-85e8-7472d7337572` remains active under its earlier actor. The coordinator rejected same-folder continuation with `CHECKOUT_IN_USE`; no task claim, submission, or completion was fabricated. Existing records and the quarantine were left intact.

## Linux package artifacts

Built on Ubuntu 26.04.1 LTS, x86_64, with Rust 1.99.0 and Tauri CLI 2.12.4. These are local build artifacts; do not distribute until the release blockers above are cleared.

| Artifact | Size | SHA-256 | Container install check |
|---|---:|---|---|
| `src-tauri/target/release/bundle/deb/Reclaim_0.1.0_amd64.deb` | 4,422,790 bytes | `1cb57fe578bd21da0b933b1543e26f53bdd31ad2be93cb37053cc9aea5650222` | Debian stable: install, launch under Xvfb, SQLite `ok`, 17 categories, remove package; data retained |
| `src-tauri/target/release/bundle/rpm/Reclaim-0.1.0-1.x86_64.rpm` | 4,428,125 bytes | `af78c9c09ebd88fa79264c4b71104db69f2258eee683f95564533d71953806f9` | Fedora 44: install, launch under Xvfb, SQLite `ok`, 17 categories, remove package; data retained |

Checksums are also in `src-tauri/target/release/bundle/SHA256SUMS` and verified with `sha256sum -c`. Those paths are build output and are intentionally ignored by Git.

## Build and release gates

Run against the final commit:

```sh
pnpm test
pnpm build
pnpm check:design
cargo test --manifest-path src-tauri/Cargo.toml
pnpm tauri build --bundles deb,rpm
```

Release remains blocked until the final byte-based photo path is exercised and project licensing is selected and included. Visual and accessibility coverage is incomplete; remaining noncritical checks need completion or clear release-note disclosure before any public beta decision.

## Identity, privacy and update policy

Reclaim 0.1.0 is a single-workstation application. The configured operator name is an attribution label, not authentication or authorization. Database files, photos, logos and backups are not encrypted. Keep workstation and backup storage access limited. User-data location observed on this Linux/Tauri runtime: `~/.local/share/com.reclaim.desktop/` (the separate `XDG_DATA_HOME` was not honored by this configured runtime). App updates use packaged releases and SQLite schema migrations; close Reclaim and make a backup before installing the next package. Do not remove the user-data directory during uninstall. Automatic updates are not configured. Tauri's updater requires signed update bundles and a configured public key and endpoint; none are included for this beta.

## Artifact policy

Fresh artifact filenames, byte counts, SHA-256 checksums, build host/toolchain, package metadata, installation results, and exact paths must be recorded here only after they are actually generated and inspected. A successful bundle command alone is not a clean-install result.
