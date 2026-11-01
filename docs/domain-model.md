# Domain model

## Organization and places

One installation has one organization profile and may define multiple organization locations. A storage location belongs to the organization and may have a parent, so a front desk, room, cabinet, and shelf can be represented. Secure storage is a property of the current storage location.

## Found items and lost reports

A found item represents physical property currently or formerly in organizational custody. A lost report records a claimant's description of missing property. They are separate tables and have separate references and lifecycles.

One lost report can have many candidate found items; one found item can be considered against multiple lost reports. Review state belongs to the pair. A confirmed association does not itself return property.

## Lifecycle

Found item: `in_custody` → `returned` or `disposed`. A returned or disposed item is retained as history and cannot be transitioned a second time. Return validation checks custody state and requires a method when organization policy or secure storage calls for verification. Disposition requires a staff action after the calculated review date.

Lost report: `open`, `resolved`, or `closed`. Current UI creates and searches reports and reviews candidate matches; report editing and lifecycle controls are not yet available.

## References and history

Database UUIDs are stable internal identifiers. Human references are generated once for found items and lost reports for staff lookup and future label workflows. Significant mutations are written with before/after JSON in append-only custody events. Current staff attribution is optional and not authenticated.
