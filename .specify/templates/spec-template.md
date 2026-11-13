# Feature Specification: [FEATURE NAME]

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `[short-slug]`
**Branch**: `feat/[short-slug]`
**Status**: `Draft` | `In Review` | `Approved` | `Implemented` | `Retrospective`
**Created**: YYYY-MM-DD
**Last updated**: YYYY-MM-DD
**Owner**: [GitHub handle]
**Feature flag**: `[FLAG_NAME]` (default off)

---

## 1. Overview

One paragraph: what user-observable capability does this feature add or change, and
for which clients (Angular app, Ever Teams, desktop apps, MCP server, SDKs)?

## 2. User Scenarios

For each primary user (employee, manager, admin, API client), write a
"Given / When / Then" scenario. Include the unhappy paths (errors, permission
denials, races, offline) — they are part of the spec, not afterthoughts.

### 2.1 Primary scenarios

- **Given** [precondition], **when** [action], **then** [observable outcome].

### 2.2 Edge cases & failures

- **Given** [unusual precondition], **when** [action], **then** [graceful behaviour].

## 3. Functional Requirements

Numbered, atomic, testable. One requirement per sentence.

- **FR-1** The system MUST [behaviour].
- **FR-2** The system SHOULD [behaviour] — expected, non-blocking.
- **FR-3** The system MUST NOT [forbidden behaviour].

## 4. Non-Functional Requirements

- **Performance**: [e.g. "P95 < 300 ms for list endpoints at 10k rows per organization"]
- **Reliability**: [e.g. "no message loss while the push channel reconnects"]
- **Security & privacy**: which data is sensitive, who can read/write, what leaves the platform
- **Observability**: activity-log events, metrics, audit entries
- **Compatibility**: PostgreSQL, SQLite, MySQL; both ORMs; SDK/OpenAPI impact

## 5. Key Entities & Domain Concepts

One-line definitions. **No schema columns** — those go in the plan.

| Entity / concept | Description |
| ---------------- | ----------- |
| `[Name]`         | …           |

## 6. Out of Scope

Bullet list of what is deliberately NOT in this feature.

## 7. Acceptance Criteria

Checklist a reviewer can run against the merged change.

- [ ] [Observable outcome 1]
- [ ] [Failure / unhappy-path outcome]
- [ ] Works on PostgreSQL, MySQL and SQLite with both ORMs
- [ ] Behind `[FLAG_NAME]`; nothing changes while the flag is off
- [ ] All functional requirements have a passing test

## 8. Open Questions

- `[NEEDS CLARIFICATION: …]`

## 9. Constitution Gates

Tick each that applies; explain non-applicability for the rest.

- [ ] I Plugin-first
- [ ] II Tenant/organization scoping
- [ ] III Both ORMs, additive migrations
- [ ] IV Default-off flag; nothing removed
- [ ] V Contracts and API first; backwards compatible
- [ ] VI Permissions, privacy, security
- [ ] VII Real-time through the event bus
- [ ] VIII i18n and accessibility
- [ ] IX Tests accompany the change
- [ ] X Behaviour-first (this document)
- [ ] XI Documentation describes our platform only

## 10. References

- Related features: [links to other specs]
- Related ADRs: [`docs/specs/decisions/NNN-…`]
- Related architecture: [`docs/specs/architecture/…`]
