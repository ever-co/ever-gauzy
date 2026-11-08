# Ever Gauzy Platform Constitution

> The constitution is the highest-priority document in this repository. Every feature
> spec, implementation plan and task list MUST reconcile with these principles.
> Conflicts are resolved in favour of the constitution. Non-negotiable principles are
> marked **(NON-NEGOTIABLE)**.

**Version**: 1.0.0
**Ratified**: 2026-11-07
**Applies to**: `apps/*`, `packages/*`, `packages/plugins/*`

---

## I. Plugin-First Features (NON-NEGOTIABLE)

A new product capability (a module with its own entities, endpoints and UI) is a
**plugin package**: API side in `packages/plugins/<id>/` (a `@GauzyCorePlugin` that
registers its entities, migrations, controllers, services and MCP tools), UI side in
`packages/plugins/<id>-ui/` (Angular, registered with `@gauzy/plugin-ui`) and/or
`packages/plugins/<id>-react-ui/` (React through `@gauzy/ui-react`). `packages/core`
is for cross-cutting infrastructure that several plugins and the core domain share
(tenant, organization, employee, user, roles, tasks, comments, mentions, notifications,
files, events).

**Why**: plugins can be enabled per deployment, carry their own migrations and tests,
and keep the core small. Every integration (third-party systems, AI providers,
analytics) already follows this rule.

**Implications**:

- A feature that is used by several products (the Angular app, Ever Teams, the desktop
  apps, the MCP server) ships its API in one plugin; each product builds its own UI on
  that API.
- Plugins are listed in `apps/api/src/plugins.ts` (API) and the app's
  `plugin.config.ts` / `uiPluginConfig` (UI); nothing else in the host app changes.
- Shared types go in `@gauzy/contracts`; nothing imports another plugin's internals.

## II. Tenant and Organization Scoping (NON-NEGOTIABLE)

Every persisted record extends `TenantOrganizationBaseEntity` (or `TenantBaseEntity`
where an organization is impossible), every query runs through
`TenantAwareCrudService` or an explicit tenant/organization filter, and every endpoint
checks the caller's tenant through the `TenantPermissionGuard`. Cross-tenant reads or
writes are defects.

## III. Both ORMs, Additive Migrations (NON-NEGOTIABLE)

Entities use the `MultiORM*` decorators so that TypeORM **and** MikroORM map them.
Schema changes ship as migrations under `packages/core/src/lib/database/migrations/`
(or the plugin's migrations folder) for **PostgreSQL, SQLite/better-sqlite and MySQL**,
are **additive and forward-only** (no `DROP`, no destructive rename, no data loss),
and are registered for both ORMs. A migration that cannot run on SQLite breaks the
demo and desktop builds.

## IV. Default-Off Feature Flags and No Removal (NON-NEGOTIABLE)

New behaviour lands behind a flag that is **off by default**: a `FeatureEnum` entry
with its feature toggle, and/or an environment variable read through
`@gauzy/config`. Existing behaviour, options, endpoints, files and configuration are
never removed or replaced by a feature; when something must be superseded it is
gated, documented and left in place for the owner's decision.

## V. Contracts and API First

The REST API (NestJS, `/api/...`) is the product. Every capability is reachable
through documented endpoints (Swagger decorators, class-validator DTOs, typed
responses from `@gauzy/contracts`) before any UI is built, so that the Angular app,
Ever Teams, the desktop apps, the official SDKs (Kiota-generated from the OpenAPI
document) and the MCP server consume the same surface. Public contracts change in a
backwards-compatible way: fields are added, never repurposed; endpoints are versioned
or additive.

## VI. Permissions, Privacy and Security

Access is role-based: every mutating endpoint declares its `PermissionsEnum`
permissions through `@Permissions()`; reads respect organization membership and
employee visibility. Secrets never enter the repository or the client bundle;
integration credentials are stored encrypted in `IntegrationSetting`; inbound
webhooks verify signatures; user content is validated and sanitised before storage
and rendering. Data that leaves the platform (email, push, third-party sync) is
listed in the feature's spec.

## VII. Real-Time Through the Platform Event Bus

Domain changes are published as events (CQRS events / `@nestjs/event-emitter`) and
delivered to clients through the platform's push channel (WebSocket gateway, with
polling only as a documented fallback). Features never build a private push channel
and never ask clients to poll where a push exists.

## VIII. Internationalisation and Accessibility

Every user-visible string in the Angular app is a translation key in
`packages/ui-core/i18n/` (all shipped locales), React UI plugins use
`useTranslation()`, and emails use the email-template system. New UI is keyboard
operable and screen-reader labelled.

## IX. Tests Accompany Every Change

Services, handlers and pure helpers ship with Jest specs next to them
(`*.spec.ts`); endpoints with e2e coverage where the module already has a suite; UI
components with at least a rendering test. A change without tests is not done.

## X. Specs Are Behaviour-First

`spec.md` describes what a user or client observes (scenarios, requirements,
acceptance criteria), never the implementation. `plan.md` owns entities, endpoints,
components and migrations. `tasks.md` owns the PR-sized breakdown. A spec with an
open `[NEEDS CLARIFICATION]` marker is not approved.

## XI. Documentation Describes Our Platform

Specs, code comments, commit messages and user docs describe Ever Gauzy's behaviour
in its own terms. They never reference, compare with, or name other products or
vendors as the reason for a feature.

---

## Compliance checklist

Every `spec.md` §9 and `plan.md` §12 ticks or explains each principle:

- [ ] I Plugin-first (new capability = plugin package; core only for shared infrastructure)
- [ ] II Tenant/organization scoping on every entity and query
- [ ] III Entities and migrations for both ORMs, additive and forward-only
- [ ] IV Default-off feature flag; nothing removed
- [ ] V Contracts and API first; backwards-compatible public surface
- [ ] VI Permissions declared; secrets, webhooks and user content handled safely
- [ ] VII Real-time through the event bus and the platform push channel
- [ ] VIII i18n keys in every locale; accessible UI
- [ ] IX Tests accompany the change
- [ ] X Behaviour-first spec, no implementation details
- [ ] XI Documentation describes our platform only
