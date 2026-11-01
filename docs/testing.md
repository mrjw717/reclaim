# Testing and qualification

## Commands

```sh
pnpm test
pnpm build
cargo test --manifest-path src-tauri/Cargo.toml
pnpm check:design
pnpm tauri build --bundles deb,rpm
```

Vitest/Testing Library currently exercise setup validation, onboarding days/theme, development autofill without submission, dashboard rendering, and found-item form command submission using a mocked Tauri bridge. They do not verify SQLite or native dialogs. Rust tests use in-memory SQLite for migration/idempotence, organization persistence, hours/brand validation, organization sites, lost-report lifecycle, matching and competing claims, return/disposition rules, and backup integrity.

`pnpm check:design` scans for likely literal-color declarations. Results are heuristic and include valid palette/status/illustration values; it does not parse CSS or assess rendered contrast, layout, semantics, or keyboard behavior.

## Native and visual qualification

Run `pnpm tauri dev` for native command and filesystem testing. The current qualification record does not establish complete native end-to-end workflows, restart persistence, photo/logo round trips, backup/restore interaction, or installer startup. It also does not establish screenshot review at target desktop window sizes or a complete screen-reader/keyboard/contrast audit. See the dated `completion-audit-2026-11-01.md` and `release-readiness.md` for the observed pass/fail status.
