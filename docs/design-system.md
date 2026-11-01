# Design system

Reclaim's semantic CSS tokens live in `src/App.css` under the root theme definitions. Components use shared surface, text, border, accent, spacing, radius, shadow, and control tokens. Light is the default presentation; light, dark, and system preferences are saved in SQLite.

The desktop frame uses persistent left navigation, compact topbar, content region, and contextual item drawer. Forms use shared field components and explicit labels; buttons have primary, secondary, quiet, and icon variants. Status and secure-storage indicators combine text with color. Responsive rules adapt navigation, grids, and forms for narrower windows. Reduced-motion preferences are respected and interactive controls have focus-visible styling.

New UI should use semantic tokens rather than one-off color values and should preserve predictable headings, descriptions, and action alignment. Avoid using color alone to convey a status. Organization branding includes a persisted logo and accessible primary color. Onboarding and the main shell share a stored theme preference; Follow System uses OS preference CSS.

Run `pnpm check:design` before merging UI changes. It scans component CSS and TS/TSX for unapproved color literals, while allowing `src/theme.css` to define semantic theme values and `src/theme-palette.ts` to define the curated organization palette. The checker is intentionally deterministic and currently passes. It does not inspect screenshots, calculate rendered contrast, or replace the visual qualification matrix in `docs/release-readiness.md`.
