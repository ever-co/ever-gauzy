# Task Breakdown: Customer and supplier portal

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `customer-and-supplier-portal`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind the feature flag: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
- Paths: `cp/` = `packages/plugins/customer-portal/src/lib/`, `ui/` = `packages/plugins/customer-portal-ui/src/lib/`,
  `core/` = `packages/core/src/lib/`.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/customer-portal.model.ts` (enums, entity interfaces, DTO shapes, events,
      `IPortalSession` with the membership role, `IPortalArea`, `IPortalDocumentSource`, `IPortalDocumentProvider`,
      `IPortalProvisioning`, port tokens of plan §7) exported from `index.ts`; `InvitationTypeEnum.PORTAL`; `IComment` gains
      `audience`, `authorKind`, `anchor`. Test: contract shape spec.
- [ ] **T2**. Core portal infrastructure `core/portal/`: `PORTAL_SESSION` token, `PortalRouteGuard`, `@PortalRoute(right?)`,
      `RequestContext.currentPortalSession()`, `registerPortalAreas`, `registerPortalDocumentSources`,
      `registerPortalPartyKinds`. Files: `core/portal/portal-session.token.ts`, `core/portal/portal-route.guard.ts`,
      `core/portal/portal-route.decorator.ts`, `core/portal/portal-registries.ts`. Test: guard answers 404 unbound, 401
      without session, 403 without the right; duplicate registry keys refused at bootstrap.
- [ ] **T3** (parallel). UI route locations: `'public-sections'` and `'portal-sections'` in
      `packages/ui-core/core/src/lib/common/component-registry.types.ts`; `public-layout.routes.ts` appends registered public
      sections before `**`. Test: route registration spec; existing public routes unchanged.
- [ ] **T4**. Plugin scaffold `packages/plugins/customer-portal` (package, project, tsconfig, jest, eslint),
      `cp/customer-portal-enabled.ts` (exactly `true`), feature contributions (three features, default off) in
      `cp/customer-portal.plugin.ts`, path mapping, `.env.sample`. Test: flag parsing and feature catalogue specs.
- [ ] **T5**. Core migration `1791000052490-AddPortalColumnsToInviteAndComment` (`invite.invitationType`; `comment.audience`,
      `authorKind`, `anchor`); migrations on the shared core migration helpers of `procurement` T4 (`@gauzy/core`), entities settings
      (address), member, sign-up request, activity and `1791000052500-CreateCustomerPortalTables`. Files:
      `core/database/migrations/1791000052490-AddPortalColumnsToInviteAndComment.ts`,
      `cp/database/migrations/1791000052500-CreateCustomerPortalTables.ts`,
      `cp/entities/{portal-settings,portal-member,portal-sign-up-request,portal-activity}.entity.ts`. Test: migrations on
      SQLite; dialect branch snapshot; ORM parity; unique keys enforced; existing invite and comment specs green. Migration timestamps: `1791000052400` to `1791000052499` (`packages/core`); `1791000052500` to `1791000052599` (`packages/plugins/customer-portal`).
- [ ] **T6** (parallel). Entities supplier application and party change request and
      `1791000052510-CreateCustomerPortalReviewTables`. Files:
      `cp/entities/{portal-supplier-application,portal-party-change-request}.entity.ts`,
      `cp/database/migrations/1791000052510-CreateCustomerPortalReviewTables.ts`. Test: as T5.
- [ ] **T7**. Permission contributions with `defaultFor` (plan §9) and setting contributions `cp/customer-portal.settings.ts`
      (including `portal.roleRights` and `portal.defaultRole`); `1791000052530-SeedCustomerPortalEmailTemplates` (seven
      templates per shipped language, `EmailTemplateEnum` additions). Test: grants after the contribution reload; settings
      resolve per organization; templates on a seeded tenant.
- [ ] **T8**. Registration in `apps/api/src/plugins.ts` (`CustomerPortalPlugin`) and `apps/worker/src/plugins.ts`
      (`CustomerPortalSchedulePlugin`). Test: plugin list specs with the switch on and off.

## Phase 2 — Services, endpoints, events

- [ ] **T9**. `cp/settings/`: settings service over the contributions and the address row (address key rules, access control
      required, sign-in methods within the portal policy, public site address), rights per membership role and party kind,
      staff routes. Files: `cp/settings/portal-settings.service.ts`, `cp/settings/portal-settings.controller.ts`,
      `cp/settings/portal-rights.ts`. Test: refusal while `FEATURE_ADVANCED_ACCESS` is off; key uniqueness across tenants.
- [ ] **T10**. `cp/accounts/portal-account.service.ts`: account over `ContactCredentialService` and
      `PORTAL_ACCESS.provisionPortalUser`, linked through `organization_contact.userId`, language and time zone on the user,
      unusable hash and `metadata.passwordSet` until a password is set, refusal when the person is linked to a staff user.
      Test: one account per person; staff address refused; no second link table.
- [ ] **T11**. `cp/auth/`: public sign-in by password, email code (`ACCESS_ONE_TIME_CODES`), passkey and linked social
      provider; lockout ladder plus policy; equal answers; throttles; tokens through `AuthService`. Files:
      `cp/auth/portal-auth.service.ts`, `cp/auth/portal-auth.controller.ts`, `cp/auth/portal-throttle.ts`. Test: each
      method; timing-equal answers; staff page refuses portal users and the portal refuses staff users.
- [ ] **T12**. `cp/session/portal-session.resolver.ts` bound to `PORTAL_SESSION`; active membership switch in
      `access_user_state`; rights = rights of the membership role (`contact_buyer.role`, administrator for an individual
      party) ∩ ceiling ∩ area switches. Test: switch keeps one session; rights never exceed the ceiling.
- [ ] **T13**. `cp/members/`: give access (single, bulk from a selection as a core operation with per-party results) creating
      the `contact_buyer` membership where missing, invitations as core `invite` rows of type `PORTAL` through
      `InviteService` (7 days, resend, extend, cancel, approval of administrator invitations), suspend, resume, revoke with
      session end, dated access, sign-in and reset links; the core accept routes refuse `PORTAL` invitations. Files:
      `cp/members/portal-member.service.ts`, `cp/members/portal-member.controller.ts`,
      `cp/members/portal-bulk-access.operation.ts`, `cp/members/membership-expiry.scheduler.ts`. Test: expired and reused
      tokens refused; a portal invitation never creates a workspace; revocation ends sessions within a minute.
- [ ] **T14**. `cp/sources/`: source registry, generic list, page, PDF, attachments and action routes with `partyOf`
      re-check, customer-facing labels, `PORTAL_PRINT` rendering with the core invoice, estimate and receipt PDFs as
      fallback, field layout for other sources, view and download activity. Files: `cp/sources/portal-source.registry.ts`,
      `cp/sources/portal-documents.controller.ts`, `cp/sources/portal-documents.service.ts`. Test: provider contract test
      kit (`cp/testing/portal-source.contract.ts`) used by every source.
- [ ] **T15**. Shipped sources over what exists: core invoices, estimates (answer through the existing estimate answer),
      payments and appointments (`employee_appointment` of the party's people, linking to the booking pages); `order`
      orders; `fulfillment` deliveries; `purchasing` purchase orders. Files:
      `cp/sources/shipped/{invoice,estimate,payment,appointment,order,delivery,purchase-order}.source.ts`. Test: the
      contract kit per source; another party's document answers 404.
- [ ] **T16** (parallel). `cp/addresses/`: party address book over `AddressService`, defaults, issued documents untouched.
      Files: `cp/addresses/portal-address.service.ts`, `cp/addresses/portal-address.controller.ts`. Test: default switch;
      removal keeps document copies.
- [ ] **T17**. `cp/shell/`: menu from registered areas and rights, home cards, updates feed, profile on the portal user,
      email change by code, password change, link to the public site. Files: `cp/shell/portal-shell.controller.ts`,
      `cp/shell/portal-menu.service.ts`, `cp/shell/portal-profile.service.ts`. Test: hidden areas for missing plugins and
      rights.
- [ ] **T18**. Events on the outbox (plan §5), the one `portal_activity` writer registered as an audit source of access
      control, membership changes in `activity_log`, party timeline source (`RECORD_TIMELINE_SOURCES`), user-list extension
      hiding portal users. Files: `cp/events/portal-events.ts`, `cp/activity/portal-activity.writer.ts`,
      `cp/activity/portal-timeline.source.ts`, `cp/users/portal-user-list.extension.ts`. Test: each action writes one
      activity row that the audit trail and the timeline both show; staff user list excludes portal users.
- [ ] **T45**. Custom domains (spec FR-8): the organization's portal address is shown on the settings page, and when a
      verified custom domain of the organization (core `channel_domain`, `portal_settings.customDomainId`) is routed to
      the deployment, portal and public routes resolve the organization from the request host. Files:
      `cp/settings/portal-domain.resolver.ts`, `cp/settings/portal-settings.service.ts`. Test: a request on the verified
      domain serves that organization's portal; an unverified domain answers 404; the address key keeps working.
- [ ] **T46**. Account security, password reset (spec FR-13): password reset by an emailed link valid 60 minutes that
      ends the person's other sessions. Files: `cp/auth/portal-password-reset.service.ts`,
      `cp/auth/portal-security.controller.ts`. Test: `cp/auth/portal-password-reset.service.spec.ts`: a link older than
      60 minutes is refused; using a link ends the other sessions.
- [ ] **T51**. Account security, enrolment and passkeys (spec FR-14): enrolment of an authenticator app and passkeys on
      the person's contact login, with recovery codes, through the one-time code and passkey services of access
      control. Files: `cp/auth/portal-second-factor.service.ts`, `cp/auth/portal-security.controller.ts`. Test:
      `cp/auth/portal-second-factor.service.spec.ts`: an enrolled authenticator is asked for at the next sign-in; a
      passkey signs in; a recovery code works once.
- [ ] **T52**. Account security, sessions (spec FR-14): the person lists and ends their own sessions from the profile
      (the page is part of T21). Files: `cp/auth/portal-sessions.service.ts`, `cp/auth/portal-security.controller.ts`.
      Test: `cp/auth/portal-sessions.service.spec.ts`: only the person's own sessions are listed; ending a session signs
      it out.

## Phase 3 — UI surfaces

- [ ] **T19**. `ui/portal/`: layout, branding (`PORTAL_BRANDING` fallback), sign-in, invitation, reset pages registered in
      `public-sections`; i18n keys `CUSTOMER_PORTAL.*` in every locale. Test: rendering and keyboard navigation specs.
- [ ] **T20**. `ui/portal/documents/`: generic list (filters, search, export, saved views) and page (sandboxed print HTML,
      core PDF or field layout, actions bar, related documents, attachments, shared comments). Test: rendering specs;
      screen-reader labels.
- [ ] **T21** (parallel). `ui/portal/`: home, addresses, profile and security, notice preferences, party switcher. Test:
      rendering specs.
- [ ] **T22**. `ui/staff/`: settings pages, rights per membership role, menu, document kinds; Portal tab and "Give portal
      access" on contact, person and vendor pages through `PageTabRegistryService`, named apart from "Invite as own
      workspace". Test: rendering specs; unsaved-change guard.
- [ ] **T23** (parallel). Portal slots `portal.area.page`, `portal.home.card`, `portal.document.actions`,
      `portal.document.panel` in the Angular shell, open to React blocks of other plugins through the existing
      `@gauzy/ui-react` host with the portal session as context; no separate React package. Test: a sample React block
      renders in `portal.home.card` with the session's party only.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T24**. MCP `packages/mcp-server/src/lib/tools/customer-portal.ts` (plan §7) registered in `register-all-tools.ts`.
      Test: tool specs; invite previews by default.
- [ ] **T25**. Port bindings in `apps/api/src/plugin-composition.ts` (`PORTAL_PROVISIONING` also as `PURCHASING_PORTAL`
      and `SUBCONTRACTING_PORTAL`; consumed ports with fallbacks). Test: composition spec with and without each owner.
- [ ] **T26**. OpenAPI regenerated, SDK regeneration noted; user docs (portal set-up, inviting, roles, supplier pages);
      `docs/specs/README.md` row. Test: docs build.

## Phase 5 — Depth (plan phase 2)

- [ ] **T27**. Self sign-up: confirmation code, `PUBLIC_FORM_DEFENCE`, matching by `emailKey` and the CRM duplicate check
      through `PORTAL_DUPLICATE_CHECK`, individual customer creation, supplier request, duplicate flag, approval queue with
      bulk decisions, 30-day expiry. Files: `cp/signup/portal-signup.service.ts`, `cp/signup/portal-signup.controller.ts`,
      `cp/signup/signup-expiry.scheduler.ts`. Test: each branch of FR-25; rate limits.
- [ ] **T28**. Administrator self-service: members, invitations with roles no higher than their own, domain suggestions,
      staff approval of other addresses, last-administrator rule. Files: `cp/members/party-members.service.ts`,
      `cp/members/party-members.controller.ts`, `ui/portal/members/party-members-page.component.ts`. Test: privilege
      escalation refused; last administrator kept.
- [ ] **T29**. Notices: source event consumers, member preferences per area in the notification preferences of the portal
      user, language, digest above the threshold, `PORTAL_MAIL` with core email fallback. Files:
      `cp/notices/portal-notices.consumer.ts`, `cp/notices/portal-digest.scheduler.ts`. Test: one notice per event and
      member; digest grouping.
- [ ] **T30**. Real time: streamed events, audience `portal:<kind>:<id>`, page refresh hints. Files:
      `cp/realtime/portal-realtime.ts`, `ui/portal/services/portal-live.service.ts`. Test: a paid invoice updates an open
      page within 5 s; another party gets nothing.
- [ ] **T31**. Payments: pay invoices and order deposits through `PORTAL_PAYMENTS` and `PAYMENT_CHECKOUT` (fallback the
      invoice-payment connector), statements, saved payment methods block. Files: `cp/payments/portal-payments.service.ts`,
      `cp/payments/portal-payments.controller.ts`, `ui/portal/payments/portal-pay-page.component.ts`. Test: one checkout
      for two invoices; replayed provider notice records once.
- [ ] **T32**. Quotations through `PORTAL_QUOTATIONS` (online acceptance rules, signer from the member, latest revision);
      deliveries with tracking link and return entry; loyalty points through `PORTAL_LOYALTY`. Files:
      `cp/sources/quotation.source.ts`, `cp/sources/shipped/delivery.source.ts`, `cp/loyalty/portal-loyalty.card.ts`.
      Test: concurrent answers keep one; expired quotation refused.
- [ ] **T33**. Supplier sources: requests for quotation, supplier quotations, purchase order confirmations, shipping
      notices and drop-ship confirmations through procurement; bills from orders through `PORTAL_BILLS`; bills and
      remittances lists. Files: `cp/sources/supplier/{rfq,supplier-quotation,purchase-order-confirmation,bill,remittance}.source.ts`.
      Test: uninvited request answers 404; bill lands in review.
- [ ] **T34**. Projects through `PORTAL_PROJECTS`: stakeholder switches, project page, tasks, client comments as core
      comments with `audience = EXTERNAL` and `authorKind = PORTAL`, task requests in the intake status, milestone
      decisions, timesheets without rates. Files: `cp/projects/portal-projects.service.ts`,
      `cp/projects/portal-projects.controller.ts`, `ui/portal/projects/portal-project-page.component.ts`. Test: time hidden
      without the switch; no rate, cost or internal comment in any payload.
- [ ] **T35** (parallel). Production progress through `PORTAL_PRODUCTION`. Files: `cp/production/portal-production.source.ts`.
      Test: closed work orders not listed. Party change requests and questions on documents are T47 and T48.
- [ ] **T36**. Staff: sign-up and change-request queues, activity on the Portal tab, staff answers as shared comments,
      read-only preview as member through access control impersonation. Files: `cp/staff/portal-staff-queues.controller.ts`,
      `cp/staff/portal-preview.service.ts`, `ui/staff/portal-tab/portal-tab.component.ts`. Test: preview cannot write.
- [ ] **T37**. Report rows of spec FR-97 in the core report catalogue (category "Portal" keyed `FEATURE_CUSTOMER_PORTAL` in the
      shared catalogue feature filter of `report-builder-and-dashboards`) with their sources. Files:
      `cp/reports/portal-report.definitions.ts`. Test: seeded tenant rows; with the flag off the report list and menu are
      unchanged.
- [ ] **T47**. Party change requests (spec FR-67): an administrator's change of the party's legal name or
      tax number becomes a `portal_party_change_request` that staff accept or decline; phone, website and logo change
      directly. Files: `cp/party/party-change-request.service.ts`, `cp/party/party-change-request.controller.ts`. Test:
      a legal-name change leaves the party unchanged until accepted; a decline tells the administrator.
- [ ] **T48**. Questions on documents (spec FR-52): a member with the right asks about a document; with the
      helpdesk on a ticket linked to the document opens through `PORTAL_TICKETS`, else the document's owner is emailed.
      Files: `cp/questions/document-question.service.ts`, `cp/questions/document-question.controller.ts`. Test: ticket
      linked to the document with the helpdesk on; one email to the owner without it.

## Phase 6 — Advanced capabilities (plan phase 3)

- [ ] **T38**. Further party kinds through `registerPortalPartyKinds` (applicants, learners) and the role switcher; one
      menu, home and notices per role. Files: `cp/party-kinds/portal-party-kinds.ts`,
      `ui/portal/role-switcher/role-switcher.component.ts`. Test: a person with three roles sees each menu only in its role.
- [ ] **T39**. Assistant `cp/assistant/`: `PORTAL_ASSISTANT` binding, conversations as `ai_chat_conversation`, party-scoped
      tools, sources and links, refusals, proposals instead of actions, hand-over, feedback, usage and budget of the
      purpose `portal.assistant`. Test: another party's record never reaches the prompt; budget refusal.
- [ ] **T40**. Shared approval through `PORTAL_APPROVALS` (`IApprovalGateway`): approval request with portal approvers and
      the required count, line and quotation comments live to the owner, acceptance gate, approvers in the certificate,
      a new revision cancels the request and starts another. Files: `cp/approvals/portal-quotation-approval.service.ts`,
      `ui/portal/quotations/quotation-review-panel.component.ts`. Test: acceptance refused below the required approvals.
- [ ] **T41**. Supplier onboarding: public application, checks, request changes, approval through
      `PORTAL_SUPPLIER_ONBOARDING`, renewal requests on expiring documents. Files:
      `cp/onboarding/supplier-application.service.ts`, `cp/onboarding/supplier-application.controller.ts`,
      `cp/onboarding/document-renewal.scheduler.ts`. Test: duplicate tax number flagged; approval creates supplier,
      members and documents in one transaction.
- [ ] **T42** (parallel). Reorder through `PORTAL_ORDER_REQUESTS` at the party's group prices. Files:
      `cp/reorder/portal-reorder.service.ts`, `ui/portal/orders/reorder-page.component.ts`. Test: unavailable items
      listed. Party keys and live viewers are T49 and T50.
- [ ] **T43**. Benchmarks: list at 50,000 documents per party, sign-in throughput, 5,000 sessions per node. Files:
      `cp/testing/benchmarks/portal-list.bench.ts`, `cp/testing/benchmarks/portal-sign-in.bench.ts`. Test: budgets of
      spec §4 met on PostgreSQL and MySQL.
- [ ] **T44**. Default for existing tenants, `FEATURE_CUSTOMER_PORTAL`: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
      Files: `cp/customer-portal.plugin.ts`. Test: a request for quotation sent by a tenant created before the change
      invites nobody and its staff pages show no Portal tab.
- [ ] **T49**. Party keys (spec FR-90): an administrator creates keys through access control keys, limited
      to the party's portal rights (read-only by default), with expiry (default 90 days, at most 365) and rate, shown
      once and revocable; calls are audited as the party. Files: `cp/keys/party-keys.service.ts`,
      `cp/keys/party-keys.controller.ts`, `ui/portal/keys/party-keys-page.component.ts`. Test: key refused outside the
      party's rights; expiry above 365 days refused; a revoked key answers 401.
- [ ] **T50**. Live viewers (spec FR-91): staff with a record open see which portal members are viewing
      it, from portal page presence on the realtime channel. Files: `cp/realtime/portal-viewers.ts`,
      `ui/staff/live-viewers/live-viewers.component.ts`. Test: a member opening an invoice shows on the staff page within
      5 s and leaves when they close it; members never see staff presence.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Scope, flags and compatibility | T4, T9 |
| FR-2 | §3.1 Scope, flags and compatibility | T3, T13, T22 |
| FR-3 | §3.1 Scope, flags and compatibility | T10, T16 |
| FR-4 | §3.1 Scope, flags and compatibility | T4, T5, T44 |
| FR-5 | §3.2 Portal settings | T9 |
| FR-6 | §3.2 Portal settings | T9, T11 |
| FR-7 | §3.2 Portal settings | T19 |
| FR-8 | §3.2 Portal settings | T45 |
| FR-9 | §3.3 Portal accounts and sign-in | T10 |
| FR-10–FR-11 | §3.3 Portal accounts and sign-in | T10, T11 |
| FR-12 | §3.3 Portal accounts and sign-in | T11 |
| FR-13–FR-14 | §3.3 Portal accounts and sign-in | T46, T51, T52 |
| FR-15 | §3.3 Portal accounts and sign-in | T10, T11 |
| FR-16 | §3.3 Portal accounts and sign-in | T2, T12 |
| FR-17 | §3.3 Portal accounts and sign-in | T12, T13 |
| FR-18 | §3.3 Portal accounts and sign-in | T13, T22 |
| FR-19 | §3.4 Provisioning, invitations and sign-up | T13, T22 |
| FR-20 | §3.4 Provisioning, invitations and sign-up | T10, T13 |
| FR-21–FR-22 | §3.4 Provisioning, invitations and sign-up | T13 |
| FR-23 | §3.4 Provisioning, invitations and sign-up | T13, T25 |
| FR-24–FR-26 | §3.4 Provisioning, invitations and sign-up | T27 |
| FR-27 | §3.4 Provisioning, invitations and sign-up | T7, T13 |
| FR-28 | §3.5 Members, roles and administrator self-service | T7, T9, T22 |
| FR-29 | §3.5 Members, roles and administrator self-service | T12 |
| FR-30 | §3.5 Members, roles and administrator self-service | T12, T21 |
| FR-31–FR-34 | §3.5 Members, roles and administrator self-service | T28 |
| FR-35 | §3.5 Members, roles and administrator self-service | T36 |
| FR-36 | §3.6 Portal menu, home and areas | T15, T17 |
| FR-37 | §3.6 Portal menu, home and areas | T9, T22 |
| FR-38 | §3.6 Portal menu, home and areas | T17, T21 |
| FR-39 | §3.6 Portal menu, home and areas | T2, T17, T23 |
| FR-40 | §3.7 Document lists and pages | T14, T20 |
| FR-41 | §3.7 Document lists and pages | T14 |
| FR-42–FR-43 | §3.7 Document lists and pages | T14, T20 |
| FR-44 | §3.7 Document lists and pages | T14, T18 |
| FR-45 | §3.7 Document lists and pages | T20 |
| FR-46 | §3.8 Customer documents | T32 |
| FR-47 | §3.8 Customer documents | T15, T32 |
| FR-48 | §3.8 Customer documents | T31 |
| FR-49 | §3.8 Customer documents | T32 |
| FR-50–FR-51 | §3.8 Customer documents | T31 |
| FR-52 | §3.8 Customer documents | T48 |
| FR-53–FR-57 | §3.9 Supplier documents | T33 |
| FR-58–FR-63 | §3.10 Projects, tasks and timesheets | T34 |
| FR-64–FR-65 | §3.11 Addresses, profile and party details | T16, T21 |
| FR-66 | §3.11 Addresses, profile and party details | T17, T21 |
| FR-67 | §3.11 Addresses, profile and party details | T21, T47 |
| FR-68 | §3.12 Production progress | T35 |
| FR-69 | §3.13 Notices, real time and activity | T30 |
| FR-70 | §3.13 Notices, real time and activity | T29 |
| FR-71 | §3.13 Notices, real time and activity | T17, T18 |
| FR-72 | §3.13 Notices, real time and activity | T18 |
| FR-73 | §3.14 Staff pages | T22, T36 |
| FR-74 | §3.14 Staff pages | T27, T36 |
| FR-75 | §3.14 Staff pages | T22 |
| FR-76–FR-77 | §3.15 One portal for every outside role (advanced) | T38 |
| FR-78–FR-81 | §3.16 Portal assistant (advanced) | T39 |
| FR-82–FR-84 | §3.17 Shared approval of quotations (advanced) | T40 |
| FR-85–FR-88 | §3.18 Supplier self-service onboarding (advanced) | T41 |
| FR-89 | §3.19 Reorder, own keys and live presence (advanced) | T42 |
| FR-90 | §3.19 Reorder, own keys and live presence (advanced) | T49 |
| FR-91 | §3.19 Reorder, own keys and live presence (advanced) | T50 |
| FR-92 | §3.20 API, MCP and extension | T14, T26 |
| FR-93 | §3.20 API, MCP and extension | T2, T14 |
| FR-94 | §3.20 API, MCP and extension | T2 |
| FR-95 | §3.20 API, MCP and extension | T24 |
| FR-96 | §3.20 API, MCP and extension | T18 |
| FR-97 | §3.21 Reports | T37 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- Every registered source passes the portal source contract kit (no other party, no internal field or comment, rate or
  cost).
- Public invoice and estimate links, client invitations and the contact login staff routes behave as before (existing
  suites green).
- Every `(advanced)` requirement has its acceptance criterion passing.
