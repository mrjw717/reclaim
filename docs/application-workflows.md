# Application workflows

## First run

If no organization exists, a five-step wizard collects organization identity and optional local logo, primary site, appearance, seven-day operating hours, retention and verification defaults, and a final review. Organization preferences are stored in SQLite; returning to earlier steps retains the in-memory draft. Setup seeds default categories and storage areas.

Operating hours are structured JSON, ordered Monday through Sunday. Each day can be opened/closed independently and supports one interval, including an explicitly marked overnight interval. Multiple intervals per day are not supported. Existing free-text hours are retained in `legacy_operating_hours` for staff to review after migration.

Overnight semantics: an open day is the single interval `[opens, closes)` on that weekday, or `[opens, closes)` ending on the next calendar day when "Closes next day" (overnight) is marked. A day whose close time is earlier than its open time is only valid when the overnight flag is set, and an overnight close time must be strictly earlier than the open time; equal open and close times are rejected in both modes because they cannot distinguish a zero-length day from a 24-hour day (24-hour service is recorded as 00:00–23:59). An overnight interval belongs to its own weekday and does not change the neighboring day's open/closed state, so Friday 20:00–02:00 and Saturday 22:00–04:00 with Sunday closed are both valid schedules. The native validation and the setup/Settings editor enforce the same rules, and the review summary and hours list mark such intervals as "next day".

## Found items

Found items use a native-generated reference and SQLite record. Staff may add a photo, edit details, move storage, inspect custody history, return, or record a disposition after the review deadline. Inventory filters by search, category, storage, status, and date range, with native-backed pages.

## Lost reports and matching

Reports can be edited, closed, and reopened while unresolved. Reopening a resolved report is allowed; editing a resolved report requires reopening first. Candidate scores are ranking aids only. Staff may dismiss, reopen, or confirm a claim association. A found item cannot be associated with two confirmed claims; staff must remove the existing association first. Return remains a separate verification decision.

Adjudication guards: selecting a leading claim asks for explicit confirmation that names the claimant and any competing open claims, then (when confirmed) dismisses competing suggestions and records the decision in custody history in one transaction — declining leaves every suggestion untouched. Adjudication is refused for closed or resolved reports, returned or disposed items, and items already associated with a different confirmed claimant. Repeating an adjudication for the same claim is idempotent for claim state (one confirmed row) and only adds honest history events. If the database rejects any write during adjudication, the whole operation rolls back and no partial claim state or history is kept. A database-level unique index additionally makes two confirmed claimants for one item impossible even through unforeseen code paths.

## Organization settings

Settings include organization profile, logo and brand color, structured hours, organization sites (add/edit/archive/restore), categories, storage areas, policy defaults, backup/restore, staff attribution label, and theme. Theme and brand settings are saved to SQLite and included in backups.

## Development autofill

Development builds expose **Autofill Test Data** on setup, found-item, and new lost-report forms. It uses fictional example data, only fills fields, and never submits. Found-item examples cover ordinary, matching, high-value, secure-storage, duplicate-candidate, retention-eligible, and invalid-required-field cases; lost-report examples cover ordinary, matching, competing-claim, and invalid-required-field cases. The secure-storage example leaves storage unselected when no active secure area exists, so the required field blocks saving until staff choose a location. Vite production builds replace the control with an empty component.

## Identity boundary

`staff_name` is an editable local attribution label written with supported events. It is not a login, verified identity, or access-control mechanism. Reclaim currently targets one local workstation and has no staff accounts or role permissions.
