# Reclaim — MIT release licensing checklist

Reclaim release target: 0.1.0 public beta.

## Before release

1. Replace `[COPYRIGHT HOLDER]` in `LICENSE` with the actual rights holder (an individual or company). Confirm that this person/entity has the rights to license all original code and assets. The 2026 year can remain for the first release.
2. Add `LICENSE` at the repository root, commit it, and include the full license text with every distributed source copy and substantially copied portion.
3. Add `"license": "MIT"` to the root `package.json` (or the appropriate published package metadata). Do not replace an existing license field without examining why it differs.
4. Add a `License` section to `README.md`: `Reclaim is licensed under the MIT License. See [LICENSE](LICENSE).`
5. Include `LICENSE` in Linux application packages and preferably make it accessible in an About / Legal screen or accompanying documentation. Verify the actual `.deb` and `.rpm` payloads, not just project source.
6. Inventory runtime and bundled build dependencies (npm/pnpm and Rust crates), fonts, icons, photographs, artwork, and any copied code. Verify their licenses separately; MIT licensing of Reclaim does **not** relicense third-party material. Produce `THIRD_PARTY_NOTICES.md` if attributions or license copies are required by their terms, and include those notices with packages.
7. Review and exclude example photos/assets whose rights or reuse permissions are uncertain. Use original or properly licensed assets.
8. Check any previous contributors, contractor agreements, copied code, or company ownership obligations before licensing the complete repository as MIT.
9. Ensure releases don't bundle private SQLite databases, QA user data, secrets, logs with personal information, or signing credentials.
10. Rebuild and install-test the final bundles; verify the About screen / included license and third-party notices. Publish only with authorization.

## MIT implications

MIT permits commercial use, modification, redistribution, private forks, and sublicensing, provided the copyright and permission notice are preserved. It does not require downstream users to publish source changes. It provides an AS-IS warranty disclaimer and does not grant rights to third-party logos, trademarks, or materials outside the licensed software.

## License files

- `LICENSE`: mandatory MIT license text for original Reclaim code once holder is inserted. **Done: added with Kynex Media as the rights holder.**
- `THIRD_PARTY_NOTICES.md`: optional template to populate with required third-party attributions; do not distribute a placeholder as if it were a completed compliance audit. **Done: generated from the actual dependency graph by `scripts/generate-notices.mjs`; the standalone `THIRD_PARTY_NOTICES.template.md` placeholder was removed once the generated file replaced it.**

This checklist is general software-release guidance, not a substitute for a dependency-specific licensing review or legal advice.
