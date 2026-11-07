# Reclaim

Reclaim is a local-first desktop lost and found application for a single organization. It uses Tauri v2, React, TypeScript, Rust, and SQLite. The organization may define multiple physical locations and nested storage locations. Records and imported photographs stay in the operating system's app-data directory; no account or network connection is required.

## Develop

Requirements: Rust stable, Node.js, pnpm, and the Tauri v2 host prerequisites for your operating system.

```sh
pnpm install
pnpm tauri dev
```

## Verify and package

```sh
pnpm test
pnpm build
cargo test --manifest-path src-tauri/Cargo.toml
pnpm tauri build --bundles deb,rpm
```

The Linux `.deb` and `.rpm` bundles are written under `src-tauri/target/release/bundle/`. These local build artifacts are not release-qualified until all blockers in [docs/release-readiness.md](docs/release-readiness.md) are cleared.

## License

Reclaim is licensed under the MIT License. See [LICENSE](LICENSE). Copyright (c) 2026 Kynex Media.
Third-party components are covered by their own licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), generated from the actual dependency graph by `scripts/generate-notices.mjs`.

## Product documentation

- [Architecture](docs/architecture.md)
- [Database schema](docs/database-schema.md)
- [Domain model](docs/domain-model.md)
- [Application workflows](docs/application-workflows.md)
- [Design system](docs/design-system.md)
- [Testing](docs/testing.md)
- [Backup and restore](docs/backup-restore.md)
- [Release readiness](docs/release-readiness.md)

## User guides

- [Getting started](docs/user-guide/getting-started.md)
- [Daily operations](docs/user-guide/daily-operations.md)
- [Data and backups](docs/user-guide/data-and-backups.md)
- [Troubleshooting](docs/user-guide/troubleshooting.md)
- [0.1.0 release notes](docs/release-notes-0.1.0.md)
- [RC1 qualification matrix](docs/release-readiness.md)
