# Testing and qualification

## Commands

```sh
pnpm test
pnpm build
cargo test --manifest-path src-tauri/Cargo.toml
pnpm check:design
pnpm check:contrast
pnpm tauri build --bundles deb,rpm
```

Vitest/Testing Library currently exercise setup validation, onboarding days/theme, development autofill without submission, the secure-storage scenario with and without an active secure location, dashboard rendering, found-item form command submission, item photo selection/preview/removal and import payload, storage-to-site selection, and organization-site address create/edit/archive/restore payloads using a mocked Tauri bridge. The production build is also inspected for development-only autofill labels and scenario names. These frontend checks do not verify SQLite or native dialogs. Rust tests use in-memory SQLite for migration/idempotence, organization persistence, hours/brand validation, organization sites, lost-report lifecycle, matching and competing claims, return/disposition rules, photo-byte validation, and backup integrity.

`pnpm check:design` scans for likely literal-color declarations. Results are heuristic and include valid palette/status/illustration values; it does not parse CSS or assess rendered contrast, layout, semantics, or keyboard behavior.

## Native and visual qualification

Run `pnpm tauri dev` for native command and filesystem testing. In the 2026-11-01 continuation, an isolated packaged binary rendered its first-run screen, keyboard navigation reached the complete address form, and SQLite returned schema version 3 with `integrity_check=ok`. Setup was not completed in that run, so its other workflow results were not established there. At that stage, the rebuilt Debian/RPM artifacts still needed install testing; the current-source package startup/removal checks are recorded below. Screenshot review across the viewport/theme matrix and a complete screen-reader/keyboard/contrast audit remain open. See `release-readiness.md` for current and inherited evidence, limits, and release blockers.

In the 2026-11-01 readability continuation, an actual Tauri development window was run under an isolated `HOME`. Setup and one fictional found-item save were completed. After closing and reopening the app against that profile, the native dashboard loaded the saved record; SQLite still reported `PRAGMA integrity_check=ok`, `user_version=3`, one organization, one primary site, three storage locations linked to that site, one found item, and its custody event. The photo table remained empty. Native screenshots were inspected at 1440×920, 1024×768, and 680×844 (the native window enforced a 680 px minimum width). The native photo chooser opened but file selection could not be completed because this host did not accept text entry through its available virtual-keyboard/accessibility path. Custom site address entry and Settings lifecycle operations were not completed, and backup/restore were not replayed. The prior native archive evidence remains attributed to the earlier qualification report. The current frontend suite has 11 tests, including the accessible size control and saved preference; automated accessibility and screen-reader coverage remain open. A current-source `pnpm tauri build --bundles deb,rpm` succeeded and generated checksummed local artifacts, but those bytes still need clean-install/uninstall walkthroughs before package qualification.

## Later native workflow continuation — 2026-11-01

Two disposable profiles were used with the actual Tauri development app. Settings edited an existing fictional site to a complete address, archived and restored it, and created linked storage; SQLite confirmed the address and relationship after restart. A new complete-address site was not successfully created in this run. Native JPEG selection, found-item save, photo preview after restart, backup archive integrity, restore through the native chooser into a different profile, and restored photo preview after another restart all succeeded. SQLite reported `PRAGMA integrity_check=ok`. Settings saved Dark to the organization row and retained it after restart; the 1.3 interface-size preference was present in WebKit local storage after restart.

The native logo chooser could not be completed reliably, so logo persistence remains unverified. One blank-address fictional site was created inadvertently during UI navigation and remains only in disposable test data. No screen-reader or rendered-contrast audit, independent schedule edit/validation, setup review-to-dashboard replay, screenshot matrix, or clean package install/uninstall was performed in this continuation. These observations supersede earlier session-specific statements above that those native workflows had not yet been performed; they do not change what was observed in the earlier runs.

## Native setup and organization settings continuation — 2026-11-01

In a disposable profile, the actual Tauri development app completed the five-step setup at 820×772, reached Review, and opened the workspace. Setup saved Dark theme, interface scale `1.3`, and Saturday hours 09:00–17:00; SQLite contained the full seven-day schedule and `PRAGMA integrity_check=ok`. Settings hours editing was attempted, but the native time-spin value could not be reliably read back, so no edit result is claimed.

The same profile selected a fictional JPEG through the native organization-logo chooser, displayed the Settings preview, saved, and restarted. The preview remained after restart and SQLite retained a 3,227-byte JPEG data URL. The site form created `Northside South Campus` with complete address; its postal code was edited from `62706` to `62707`, then archived and restored. After process restart, SQLite showed the complete address, `active=1`, and integrity `ok`. Earlier disposable-profile checks cover linked storage and photo/backup/restore workflows.

Frontend keyboard coverage now verifies theme radio arrow navigation in Settings and setup. The shared theme groups use one tab stop; the custom policy checkbox has a visible focus ring; setup switches to one column through 860 px. The actual app's accessibility tree was available at 820×772, but screenshot capture returned a black webview, preventing visual confirmation of that layout. No screen-reader or rendered-contrast audit, full keyboard audit, schedule edit validation, or package install walkthrough was performed. Current checks: `pnpm test` (12 passed), `pnpm build`, `pnpm check:design`, `cargo test --manifest-path src-tauri/Cargo.toml` (21 passed), and `git diff --check` all passed.

### Native appearance and schedule verification follow-up — 2026-11-01

In the same isolated organization profile, selected primary color `#174ea6` from the accessible swatches, saved, and restarted. The shell displayed blue primary controls and the saved logo; SQLite retained `theme=system`, `primary_color=#174ea6`, 3,227 bytes of logo data, and `integrity_check=ok`. Focused Saturday's opening-hour hour segment, pressed Up through the keyboard, saved, and restarted; the Settings editor and SQLite both showed Saturday `10:00` (from `09:00`).

At interface scale 1.3, inspected main-app screenshots at 1440×920, 1024×740, 820×772, and 680×816. Text wrapped within the dashboard cards and controls remained inside each viewport; lower content scrolls, including under the fixed bottom navigation on the narrow view. Setup at 820 exposed its full form in the accessibility tree, but the capture showed only the decorative sidebar and a blank content area, so that layout remains visually unverified. Screen-reader, rendered-contrast, full keyboard, and package-install checks remain open. No source code changed after the previously listed passing automated checks; `git diff --check` was rerun after documentation updates.

### Setup responsive visual follow-up — 2026-11-01

Inspection found the 860px setup rules were placed before the base `.setup-aside` and `.setup-content` declarations. Those later `min-height: 100vh` rules overrode the compact layout and pushed the form below the viewport. Moving the breakpoint below the base rules fixed it: the setup form now renders in one column at 820×772 and in two columns at 1024×740, both visually inspected at 1.3 scale. The cramped step names at 1024/1.3 are now replaced by segmented progress marks; all step names remain in labeled accessibility groups and the active step is marked.

After these source changes, `pnpm test` passed (12 tests), `pnpm build` passed, `pnpm check:design` passed, and `git diff --check` passed. Rust sources were unchanged, so the earlier Rust 21-test result still applies to the native backend. The preceding blank-capture note is superseded by this visual follow-up; complete screen-reader, contrast, full keyboard, and package-install audits remain open.

The 2026-11-01 light-theme contrast follow-up calculated `--text-muted` and `--text-subtle` against the core light surfaces and updated them to meet at least 4.5:1 on their documented text surfaces. This covers those token pairs only; accent/status colors and the full rendered interface have not been audited. See `release-readiness.md` for the exact values and ratios.

### Native setup transition, photo persistence, and current checks — 2026-11-01

In an isolated Xvfb display and disposable app-data profile, completed onboarding through Review at 1024×740, scrolled to the end, and opened the workspace. This reproduced the dashboard inheriting the review page's scroll offset, hiding its header controls. The app now resets document and body scroll when setup completes; `App.test.tsx` sets both offsets before transition and checks they return to zero. The native rerun showed the header and text-size controls immediately.

At interface scale 1.3, inspected the dashboard at 1024×740, 820×772, and 680×768. Controls stayed within the window and text wrapped; at 680 px, lower content scrolls under the fixed bottom navigation. Full keyboard/focus and screen-reader audits remain open. Theme-radio arrow navigation and one tab stop have frontend regression coverage; the policy checkbox focus ring is present in CSS. The earlier light-text token ratios cover only the named foreground/surface pairs.

Selected a valid generated PNG through the native GTK chooser for a fictional found item. The item detail rendered its preview; SQLite `PRAGMA integrity_check` returned `ok`, a photo row stored JPEG metadata and relative original/thumbnail paths, and both files existed in the isolated local photo directory. After closing and reopening the development app with the same disposable profile, the item drawer loaded and showed the saved photo. An initial malformed PNG had an invalid IDAT CRC and was rejected; it was not treated as a successful import. This was a development build, not a packaged-app check.

Current checks after the scroll regression fix: `pnpm test` (13 passed), `pnpm build` (passed after replacing unsupported `Array.prototype.at` in the test with indexed access), `pnpm check:design` (passed), and `cargo test --manifest-path src-tauri/Cargo.toml` (21 passed). These checks and captures do not establish a screen-reader session, full contrast matrix, complete keyboard audit, or clean package install.

### Accessible-name governance follow-up — 2026-11-01

An independent source review found a storage status dismiss button without an accessible name and generic “Edit” controls in site/storage rows. Added contextual names and a polite live status announcement. Extended `pnpm check:design` with a TypeScript JSX heuristic for button/form-control names and labels; it caught the dismiss button before the fix and passes afterward. The checker does not calculate browser accessible names or replace screen-reader testing. Reverification after these changes: `pnpm check:design`, `pnpm check:contrast` (134 token pairs), `pnpm test` (13 passed), and `pnpm build` all passed. Rust sources did not change.

### Accessibility sweep, keyboard checks, and theme matrix — 2026-11-07

An axe-core 4.10.3 sweep (`node` CDP driver, no repo dependency) ran against the dev-only fixture preview across 20 rendered screens — dashboard, inventory, item drawer, found-item form, lost reports, match review, storage, retention, six Settings sections, and five onboarding steps — in four theme variants (light, dark, system-dark, system-light) plus dark/light for setup: 70 scans. Initial findings and repairs, all verified by a follow-up zero-violation sweep:

- **serious:** the selected Settings-nav description used `--text-muted` on the brand-tinted `--brand-soft` surface (below 4.5:1); now uses `--text-secondary`, guarded in `pnpm check:contrast` for every curated organization brand (146 token pairs checked).
- **serious (dark):** the brand-preview button overrode the themed `--brand-accent` with the raw user color, pairing light-theme white text with dark-theme text tokens; it now renders the real themed control.
- **serious (light setup):** the green eyebrow on the setup canvas measured 4.45:1; `--accent-green-foreground` darkened to `#4e7353` (4.9:1 on canvas) with a new token check.
- **moderate:** onboarding pages had no `h1` when the decorative aside is hidden at narrow widths; the five step headings are now `h1` elements.
- **moderate:** the dashboard "Open reports" aside was an unnamed complementary landmark nested in `main`; it now has an accessible name.
- **minor:** `role="dialog"` is not an allowed override on `<aside>`; the item drawer is now a `div` (CSS and tests unchanged).

Keyboard verification used real Tab/Shift+Tab/Escape key events through CDP in headless Chrome: 10/10 checks pass — focus containment across 40-Tab walks inside the drawer and four modal types, focus restoration to the opening element on close, Escape from a nested dialog returning into the drawer, and visible focus indicators. This uncovered and pinned two real defects (see the adjudication entry below and the modal-focus commit): `ModalFrame` re-captured its focus-restore snapshot on every parent re-render because `onClose` was a fresh inline closure (snapshot now taken during render via a ref; restore verified by `App.test.tsx`), and its Tab trap lacked the drawer's "pull focus back when it escapes" rule.

The visual/theme matrix swept 460 viewport/screen/theme/scale combinations in headless Chrome: window sizes 1024×768, 1280×800, 1440×900, 1920×1080, and the 680×680 minimum at interface scales 1 and 1.3, in light, dark, system-dark, and system-light, over nine main-app views (including open drawer and modals) plus all five onboarding steps. Rendered-layout measurements checked page horizontal scroll, zero-size clipped text (excluding visually hidden elements), and elements escaping their scroll containers past the viewport: zero issues, and screenshots were spot-checked visually. 460 PNGs and the measurement JSON live outside the repository under `/tmp/opencode/visual/`; representative captures are in `docs/evidence/2026-11-07/`.

### Installed-package staff-journey walkthroughs — 2026-11-07

All fifteen journeys were exercised through the installed Debian package in a disposable container (Xvfb + AT-SPI tree + real mouse/keyboard input via xdotool; `reclaim-qa-x11` Debian 13 image) with isolated app-data directories. Screenshots and SQLite state were verified after each phase; representative captures are in `docs/evidence/2026-11-07/`.

1. Fresh onboarding: five-step setup through Review into the workspace; SQLite organization row, complete primary-site address, seeded storage linked to the site, `user_version=3`, `integrity_check=ok`.
2. Organization logo upload: native GTK chooser → fixture PNG preview in setup and in the saved workspace; 270-byte data URL persisted and re-rendered after restart.
3. Seven-day operating hours: default schedule saved; in Settings, Saturday opened and its opening hour edited 09:00→10:00 via keyboard; all seven days verified in SQLite after a full restart.
4. Theme and brand color: Dark and curated blue `#174ea6` from setup persisted (`theme`, `primary_color`) and rendered after restart.
5. Organization-site management: second site created with the complete six-field address, edited, archived (row `active=0`), restored (`active=1`); last-active-site guard preserved.
6. Nested storage: secure cabinet linked to the new site plus a child drawer inside it (`parent_id` + site link + secure flag verified).
7. Found-item registration with photograph: full form via GUI; original + 520px thumbnail written to the managed photo store; `item_photos` row and `item_registered`/`photo_added` events attributed to the staff label.
8. Item editing and search: drawer edit persisted with `item_updated` event; inventory search returned the correct empty state and hit.
9. Lost-report lifecycle: created with matching details, edited, closed, reopened — status and attributed events verified in SQLite.
10. Matching suggestions: score 94/100 candidate with explanation list and ranking-aid disclaimer rendered from live data.
11. Competing claims, adjudication, verified return: claim selection wrote the confirmed match and `claim_adjudicated`; the return flow required the policy-mandated verification method and note and produced a `item_returned` event; item status `returned`.
12. Custody history: drawer timeline rendered the attributed event sequence.
13. Retention and disposition: an item aged past its deadline appeared in Retention review as eligible; disposition recorded through the UI (`status='disposed'`, method, `item_disposed` event). The historical found date for this disposable-profile item was set by direct SQLite update as test-data preparation; the eligibility check and disposition ran through the app.
14. Backup and restore: native save dialog produced an archive passing `unzip -t` (database + original + thumbnail + manifest); restore into a second disposable profile replaced the sentinel setup with the full workspace (items, photo files, sites, 13 events) verified in SQLite; a truncated archive was rejected in the UI ("Backup archive is damaged or invalid.") with records intact.
15. Full restart persistence: multiple process restarts on both profiles; the restored workspace re-rendered its dashboard, theme, logo, and inventory after restart.

Harness notes: AT-SPI presses on offscreen checkboxes and HTML select popups do not flip state in WebKitGTK, so those controls were driven by real mouse clicks and keyboard navigation; time inputs were edited by focusing segments and typing. One journey data point (finder contact) was lost to a chooser-automation interleave, not an app defect.

### Adjudication confirmation defect found and fixed — 2026-11-07

The installed-app walkthrough exposed a real defect: selecting a leading claim used `window.confirm`, which WebKitGTK under Tauri does not block — the dialog appeared while execution continued, the adjudication was written immediately, and choosing Cancel left `match_reviews` `confirmed` with no rollback (reproduced in the packaged app before the fix, verified fixed after: Cancel leaves the suggestion untouched, OK writes `claim_adjudicated`). The flow now uses the plugin-dialog native `confirm()` (as restore already did) with `dialog:allow-ask`/`dialog:allow-confirm` capabilities, and `src/App.test.tsx` covers the declined and accepted paths (23 frontend tests).

### Final package qualification — 2026-11-07

Final artifacts rebuilt from the fixed source (`pnpm tauri build --bundles deb,rpm`, then `scripts/patch-deb-license.sh` for the Debian license files — see the licensing section):

| Artifact | Size | SHA-256 |
|---|---:|---|
| `Reclaim_0.1.0_amd64.deb` | 4,337,404 bytes | `072ad041805b22222708ef41409a826e7389b7c6f4d34956ca6d5dff97fa34f5` |
| `Reclaim-0.1.0-1.x86_64.rpm` | 4,429,001 bytes | `080bffc76e5438aa63e01592757ec388bc64ef577ab5578cbe71a426daf2a909` |
| `Reclaim_0.1.0_amd64.AppImage` | 88,005,112 bytes | `2ef611251670b8a1b11e764892d2aadc157e2dcbd49659aea8e11ce2d5ff8b53` |

(Hashes in `src-tauri/target/release/bundle/SHA256SUMS` pass `sha256sum -c`; the deb hash covers the license-patched bundle.)

- **Debian 13**: upgrade install over the previous build preserved all records and integrity; `/usr/share/doc/reclaim/copyright` and `THIRD_PARTY_NOTICES.gz` ship in the payload (verified by payload inspection, `dpkg-deb -x` in a pristine container, and post-upgrade on-disk check — note Docker-slimmed images exclude doc files via dpkg path-exclude, which is a container artifact, not a package defect); `Maintainer: Kynex Media` and a real long description now appear in the control file; `gtk-launch reclaim` (desktop-entry resolution) opened the main window; `dpkg -r reclaim` removed the package while user data (integrity ok, items and custody history) remained.
- **Fedora 44** (this is the current-bytes rerun that replaced the 2026-11-02 evidence): `dnf install` of the exact rebuilt RPM, launch under Xvfb with an isolated HOME, database initialized (`integrity_check=ok`, `user_version=3`, 17 starter categories), `License: MIT` tag present with no signature, `rpm -e reclaim` removed the package and the database with its 17 categories remained.
- **AppImage**: builds successfully now that the release toolchain is warm (the earlier timeout was a cold optimized compile): 83.93 MiB artifact, `--appimage-extract-and-run` launches on its build baseline (Ubuntu 26.04/glibc 2.43 with the standard WebKitGTK runtime deps) and initializes a healthy database. **It is not portable to older distributions**: bundled libraries require GLIBC 2.43, and it fails on Debian 13. Qualified distribution artifacts for this beta remain the Debian and RPM packages; a portable AppImage would need an older-baseline build environment (owner decision).
- Desktop-menu invocation was verified through `gtk-launch` desktop-entry resolution in the Debian container; a full interactive desktop-shell menu click was not performed.

### Security and data-integrity review — 2026-11-07

Review of the native layer against the release checklist, with no new defects requiring code changes: SQLite uses foreign keys, CHECK constraints, partial unique indexes, versioned transactional migrations with a future-version guard, WAL with synchronous NORMAL and `secure_delete=ON`; photo imports enforce MIME allowlist, declared-vs-sniffed format matching, 15 MB and decode-dimension limits, symlink rejection, canonicalized path containment (`managed_photo_path`, covered by an existing traversal test), and file cleanup on failure; backup archives enforce size caps, safe relative paths, digest verification, reserved-name and entry-count limits, and `create_new` staging; restore uses a marker-file protocol with prior-pair recovery covered by native tests; disposition intentionally retains records and photos as documented history; Tauri capabilities are minimal (`core:default`, `opener:default`, dialog message/ask/confirm — file pickers are Rust-owned); the only stderr logging carries SQL error text, not claimant or contact data. Earlier sessions' findings (staff attribution hardening, photo validation) remain in place.

### Current Debian package startup and removal — 2026-11-01

Built current-source Debian/RPM bundles with `pnpm tauri build --bundles deb,rpm`; both output files passed checksum verification after refreshing the generated `SHA256SUMS` manifest. Installed the current `.deb` in a disposable Debian 13 `stable-slim` container and the current `.rpm` in a disposable Fedora 44 container. Started each under Xvfb for 15 seconds to allow first-run initialization, then removed each package with the native package manager. Each app database passed SQLite `PRAGMA integrity_check` and contained 17 starter categories both before and after removal; each package was absent after removal. Both package payloads contain `/usr/bin/reclaim`, the desktop entry `/usr/share/applications/Reclaim.desktop` (`Exec=reclaim`, `Icon=reclaim`, `Name=Reclaim`, `Terminal=false`), and the Reclaim icons; the binary started from each installed package. Fedora 44 `rpm -qpi` reports RPM name `reclaim`, version `0.1.0`, release `1`, architecture `x86_64`, an empty License field, and no signature. Debian metadata reports `reclaim`, version `0.1.0`, architecture `amd64`, with no License field. These checks verify basic startup and data retention, not desktop-menu invocation or full workflow behavior. No host app-data was touched. The documented manual update path covers backup, closing, package installation, restart migrations, and retaining user data; version-to-version upgrades were not tested and automatic updates remain unconfigured.

### Rendered responsive and contrast follow-up — 2026-11-01

At interface scale 1.3, a fresh native screenshot at 1024×740 exposed cramped four-column metrics and a two-column dashboard where the item table overflowed into the attention panel. At widths up to 1180 px, the dashboard now uses two metric columns and stacks the two dashboard panels. Rechecked the actual Tauri development app at 1024×740, 820×772, and 680×768. Cards no longer overlap; text and controls wrap within the window. At 680 px, the fixed bottom navigation covers content while scrolling past it, but reaching the end of the page exposes the complete quick-action card and status bar above the navigation. The 1024 px screenshot showed the keyboard focus ring around the workspace switcher.

Token review found low-contrast light-theme text in green/blue status labels and warning labels, plus white text on medium-light dark-theme brand fills and a translucent focus ring. Darkened the text tokens, added a theme-aware `--text-on-brand`, used a solid brand-accent focus ring, and changed dark-theme brand control fills to the lightened brand accent. Added `pnpm check:contrast`, which checks 134 token pairs across light/dark surfaces and curated brand choices; it now passes. Minimum checked ratios are 4.52:1 for light green status text, 4.54:1 for light blue status text, 4.53:1 for light warning text, 5.0:1 for dark field placeholders, 5.27:1 for dark brand hover text, and 4.46:1 for dark focus-indicator colors against checked surfaces. This remains a token-level audit, not a full rendered contrast or screen-reader result.

### Lost reports, inventory SQL, and staff attribution — 2026-11-02

The native Rust suite now checks lost-report edit/close/reopen persistence and history, competing-claim adjudication, and an inclusive SQLite date range across multiple inventory pages. A new inventory test inserts 12 fictional items and confirms the date-filtered total and second-page order; invalid dates and reversed ranges are rejected. The lost-report test checks the staff label on its recorded events.

Native operations that record custody or match history now propagate a missing staff-label error instead of silently using an empty string. This label is editable attribution only; Reclaim does not implement staff accounts, authentication, roles, or authorization. `cargo test --manifest-path src-tauri/Cargo.toml` passed (22 tests), `pnpm test` passed (13 tests), `pnpm build`, `pnpm check:design`, `pnpm check:contrast` (134 token pairs), and `git diff --check` passed. `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` reports formatting diffs throughout existing Rust sources; no bulk reformat was applied.

These native tests exercise SQLite functions, not the lost-report desktop UI edit/close/reopen journey. The Reclaim process was present but no Reclaim window was mapped in X11 inspection, and no normal HOME app data was opened.

### Drawer, toolbar, and lost-report layout repairs — 2026-11-06

Reproduced three layout and focus defects with a scripted headless-Chrome CDP probe (dependency-free Node driver) against `http://localhost:1420/preview.html`, a development-only Vite page that mounts the full UI over a fixture-backed command bridge (`src/dev/preview.tsx`, `src/dev/preview-bridge.ts`, fictional data mirroring the automated test fixtures). The native backend was not involved in this sweep; the preview page is not part of `pnpm build`.

- Item drawer: with overflowing drawer content, flexbox crushed the `overflow: auto` custody-history section to zero height (automatic flex minimums do not apply to scroll containers), clipping the history and — because Chrome 127+ makes scroll containers keyboard-focusable — leaving an invisible tab stop that captured keyboard focus. Reproduced at 1440×600 and other short windows; `document.activeElement` landed on the zero-height `.drawer-timeline` div. Fix: `flex-shrink: 0` on `.drawer-timeline` so it keeps its height (bounded by its own 185 px internal scroll) and the drawer scrolls as a whole.
- Inventory toolbar: between 1024 and 1440 px (both interface scales), the toolbar's fixed-width controls exceeded the panel's `overflow: hidden` box, clipping the status filter entirely. Fix: `flex-wrap: wrap` on `.inventory-toolbar`; controls now wrap to a second row instead of clipping.
- Lost-report actions: between 781 and 1000 px, grid auto-placement dropped the `.lost-actions` row into the 35 px avatar column, crushing its buttons. The older `.lost-row > .button` placement rule no longer matched because the buttons moved inside `.lost-actions`. Fix: explicit `grid-column: 2 / -1` placement in the ≤1000 px block.

Post-repair probe results: dashboard, inventory, and lost-report views at 1440/1280/1180/1024/1000/900/780/680/520/420 px widths in interface scales 1 and 1.3 report zero horizontal page overflow and zero clipped-container offenders; the drawer scrolls with its Done action reachable at every tested size; a 14-step Tab walk stays inside the drawer (and inside an open modal) and closes restore focus to the opening element. Four vitest stylesheet guards now pin the repaired declarations (`src/App.test.tsx`), because jsdom cannot reproduce the layout itself. `pnpm test` passed (20 tests). Limits: the sweep used fictional fixture data in a plain browser, not the native backend or packaged app; no screen reader, rendered-contrast matrix, or native window resize run accompanied this entry.

### Native smoke, package rebuild, and container requalification — 2026-11-06

The actual development app was launched via `pnpm tauri dev` with the repaired styles and inspected through a desktop screenshot: dark-theme dashboard, metric cards, item table, empty reports state, and quick actions rendered without overlap or clipped controls using the development profile's own local records (viewed only; no record-changing workflow was exercised).

Current-source Debian/RPM bundles were rebuilt with the new frontend (`pnpm tauri build --bundles deb,rpm`; release compile 3 m 18 s): `.deb` 4,423,574 bytes, SHA-256 `ede11ca65184e8228f3bf02626a1833b156da9434d6dc4caf0d6ccb16b72347d`; `.rpm` 4,428,853 bytes, SHA-256 `831aac9534245fcac8a69674611e4ccfa04bea884460de213b9870a841c1dea2`. `sha256sum -c SHA256SUMS` passed for both. The bundles were produced from one shared `dist/` build, so both carry the identical repaired frontend; the packaging configuration is unchanged since the 2026-11-02 Fedora 44 qualification.

Disposable-container requalification (local `reclaim-qa-x11` Debian 13 image, updated with `xauth` and `sqlite3`): the exact rebuilt `.deb` installed after dependency resolution, launched under Xvfb with an isolated HOME (`WEBKIT_DISABLE_COMPOSITING_MODE=1`, `WEBKIT_DISABLE_DMABUF_RENDERER=1`, GDK X11 backend), ran until the bounded timeout without crashing, and created `~/.local/share/com.reclaim.desktop/reclaim.sqlite3` with `PRAGMA integrity_check=ok` and 17 starter categories. `dpkg -r reclaim` succeeded and the database with its 17 categories was retained. The `.rpm` was not container-requalified in this session (no local Fedora image was available and none was pulled); its 2026-11-02 Fedora 44 install/launch/removal/retention result remains the most recent RPM container evidence, with unchanged packaging metadata. As before, desktop-menu invocation and full installed GUI workflows remain untested.

### Current-source package install/removal — 2026-11-02

Rebuilt the `.deb` (4,423,282 bytes; SHA-256 `fdc4950250b9221194d33be95eac3f91f0b79b7df7c2e375eff888d3f3439d15`) and `.rpm` (4,428,559 bytes; SHA-256 `88ec4e5deb2a728683f0a19ad5bebcf5d954c3b30b1c161c61d325251502c247`) after the 2026-11-02 native attribution source change. `sha256sum -c src-tauri/target/release/bundle/SHA256SUMS` passed for both files.

Installed each exact bundle in a disposable container (Debian 13 `stable-slim` and Fedora 44), launched the app under Xvfb with an isolated HOME, and verified SQLite `PRAGMA integrity_check=ok` and 17 starter categories. Removed the package and verified the database and categories remained. Fedora DNF reported that OpenPGP checks were skipped for the local command-line RPM; RPM metadata reports no signature and an empty License field. Debian metadata has no License field and no attached signature member. Both package launchers and icons are present; desktop-menu invocation and full packaged workflows were not exercised.
