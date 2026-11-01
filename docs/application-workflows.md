# Application workflows

## First run

If no organization exists, a four-step wizard collects organization identity and optional local logo, primary site, appearance, seven-day operating hours, retention and verification defaults, and a final review. Organization preferences are stored in SQLite; returning to earlier steps retains the in-memory draft. Setup seeds default categories and storage areas.

Operating hours are structured JSON, ordered Monday through Sunday. Each day can be opened/closed independently and supports one interval, including an explicitly marked overnight interval. Multiple intervals per day are not supported. Existing free-text hours are retained in `legacy_operating_hours` for staff to review after migration.

## Found items

Found items use a native-generated reference and SQLite record. Staff may add a photo, edit details, move storage, inspect custody history, return, or record a disposition after the review deadline. Inventory filters by search, category, storage, status, and date range, with native-backed pages.

## Lost reports and matching

Reports can be edited, closed, and reopened while unresolved. Reopening a resolved report is allowed; editing a resolved report requires reopening first. Candidate scores are ranking aids only. Staff may dismiss, reopen, or confirm a claim association. A found item cannot be associated with two confirmed claims; staff must remove the existing association first. Return remains a separate verification decision.

## Organization settings

Settings include organization profile, logo and brand color, structured hours, organization sites (add/archive/restore), categories, storage areas, policy defaults, backup/restore, staff attribution label, and theme. Theme and brand settings are saved to SQLite and included in backups.

## Development autofill

Development builds expose **Autofill Test Data** on setup, found-item, and new lost-report forms. It uses fictional example data, only fills fields, and never submits. Vite production builds do not render the control. Additional form scenarios are not yet covered.

## Identity boundary

`staff_name` is an editable local attribution label written with supported events. It is not a login, verified identity, or access-control mechanism. Reclaim currently targets one local workstation and has no staff accounts or role permissions.
