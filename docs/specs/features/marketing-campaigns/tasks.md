# Task Breakdown: Marketing campaigns

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `marketing-campaigns`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind the feature flag: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
- Paths: `mk/` = `packages/plugins/campaigns/src/lib/`, `ui/` = `packages/plugins/campaigns-ui/src/lib/`.
- Builds on, unchanged in shape: the promotion plugin's `campaign` and its service, core `contact_group`,
  `contact_group_member` and `rule`, `terms_acceptance`, the operation runtime, the tracking, unsubscribe and consent
  records of `email-and-communications`, `PUBLIC_FORM_DEFENCE` of `lead-capture-and-enrichment`, the settings store and
  permission contributions.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/marketing-campaigns.model.ts` (enums, entity interfaces, DTO shapes,
      events, ports of plan §3) exported from `index.ts`. Test: contract shape spec.
- [ ] **T2**. Plugin scaffold `packages/plugins/campaigns` (package, project, tsconfig, jest, eslint),
      `mk/campaigns-enabled.ts` (exactly `true`), `mk/campaigns.features.ts`, `mk/campaigns.permissions.ts`,
      `mk/campaigns.settings.ts` (plan §2 keys), path mapping, `.env.sample`. Test: flag parsing and catalogue specs;
      settings defaults resolve.
- [ ] **T3**. Migrations on the shared core migration helpers of `procurement` T4 (`@gauzy/core`), entities campaign satellite, cost, list
      satellite, list member, segment satellite and `1791000052700-CreateMarketingCampaignTables`. Test: migration on
      SQLite; dialect branch snapshot; ORM parity; one satellite per campaign and per contact group; unique list key. Migration timestamps: `1791000052700` to `1791000052799` (`packages/plugins/campaigns`).
- [ ] **T4**. Entities message, experiment, send, link, enrolment, party stats and
      `1791000052710-CreateMarketingMessageTables`. Test: as T3; one send per message and contact.
- [ ] **T5** (parallel). Entities touch, attribution, video, video stat and
      `1791000052720-CreateMarketingAttributionTables`. Test: as T3.
- [ ] **T6**. Permission contributions with `defaultFor` (plan §9); "Marketer" bundle template through
      `registerRoleBundleTemplates`. Files: `mk/campaigns.permissions.ts`, `mk/campaigns-role-bundles.ts`,
      `mk/campaigns.plugin.ts`. Test: registry spec for grants on a new tenant; reload adds missing rows.
- [ ] **T7**. Registration in `apps/api/src/plugins.ts` (`CampaignsPlugin`) and `apps/worker/src/plugins.ts`
      (`CampaignsSchedulePlugin`). Test: plugin list specs with the switch on and off.

## Phase 2 — Services, endpoints, events

- [ ] **T8**. `mk/settings/` and `mk/campaigns/`: campaigns as the promotion `campaign` row (through its
      `CampaignService`) plus the satellite, numbering through `SequenceService`, codes (`identifier` as typed, matched
      case-insensitively), lifecycle in the satellite's `state` (the row's status, window and archive state changed only
      with `PROMOTIONS_EDIT` and "apply to promotions"), marketing budget, costs and expense links, duplicate, members,
      linked documents and the campaign's promotions, results roll-up (messages and sequences with leads, deals,
      quotations, orders, order value, ratios, spend and cost per lead); settings routes `/marketing/settings`
      (`mk/settings/marketing-settings.controller.ts`); `mk/campaigns/marketing-campaign.service.ts`,
      `mk/campaigns/marketing-campaign.controller.ts`, `mk/campaigns/dto/`. Test: pause holds scheduled messages and
      enrolments; archived keeps results; a
      campaign made in marketing is the one the promotion routes return; pausing or archiving in marketing leaves the
      campaign's promotions applying at checkout; a caller without `PROMOTIONS_EDIT` cannot change the row's status.
- [ ] **T9**. `mk/attribution/attribution-writer.ts` over `MARKETING_CRM`: touches, and the first touch cached on leads
      from links, forms and lists as `acquiredChannel` and the campaign reference, only where empty. Test: a lead from a
      tracked link carries the campaign reference, never free text; a contact with a typed acquisition channel keeps it.
- [ ] **T10**. `mk/lists/`: lists as `STATIC` contact groups with their satellite, subscription states, import with
      consent source, counts; public subscribe guarded by `PUBLIC_FORM_DEFENCE` and the sign-up box script;
      confirmation (built-in page), person matching or lead creation, group membership written, welcome, redirect;
      `MARKETING_LISTS` port with `subscribe`, `listsOf` and `leave` (plan §3; the last two authorized by the contact and token the
      communications preference page resolved from its verified public token) (`mk/lists/marketing-list.service.ts`, `mk/lists/marketing-list.controller.ts`,
      `mk/lists/public-subscribe.controller.ts`, `mk/lists/marketing-lists.port.ts`). Test: forged token changes nothing; 11th request in an hour answers 429; a confirmed
      subscriber is in the contact's groups and leaves on withdrawal; `listsOf` with a verified link returns that
      person's lists only and `leave` withdraws one list and keeps the others; a call without a resolved token is
      refused.
- [ ] **T11**. `mk/consent/`: consent writes through `MARKETING_CONSENT` with `terms_acceptance` evidence for every
      grant, withdrawal handling, lists registered with the communications preference page, all-marketing suppression by
      communications' unsubscribe, staff-recorded consent, consent history. Test: leaving one list keeps others; leaving
      all suppresses; the evidence row verifies.
- [ ] **T12**. `mk/segments/`: segments as contact groups with their satellite; the segment strategy for `RULE_BASED`
      groups compiling `rule` rows (`CUSTOMER_SEGMENT`) to SQL over `organization_contact`, field catalogue (custom
      fields, CRM fields, `MARKETING_AUDIENCE_SOURCES` context mappings), preview count and sample, snapshot as a
      `STATIC` group written at freeze, audience union and exclusion with de-duplication. Test: each operator on three
      dialects; SQL and the core evaluator agree on a sample; count under budget on a seeded million.
- [ ] **T13**. `mk/messages/`: editor model, renderer (tokens, Markdown, blocks, sanitizing), tests outside tracking,
      link and image checks, previews, web versions and the newsletter feed (`feed.json`, `feed.xml`), approval through
      `MARKETING_APPROVALS`, start from a marketing template and save as a template through `MARKETING_TEMPLATES`. Test:
      unknown token refused; broken image named; change after approval needs approval again; an unpublished message is
      not in the feed; a message saved as a template starts a new one.
- [ ] **T14**. `mk/sending/plan.service.ts` as an operation type of the core runtime (message as aggregate): audience
      resolution at send time, skip reasons, local time due times, throttle, send-to-new, refusal of a second send.
      Test: skip counts per reason; past time refused; a stopped plan resumes without duplicates.
- [ ] **T15**. `mk/sending/dispatch.service.ts`: leasing, rendering per recipient, links registered through
      `MARKETING_TRACKING` (communications rewrites them and adds its image and unsubscribe header), hand-over through
      `MARKETING_SENDER`, failure threshold pause, resume, author notices. Test: a crash after 6,000 of 10,000 resends
      nothing already handed over.
- [ ] **T16**. Text campaigns: text body, part counter and cost through communications, consent required, quiet hours.
      Files: `mk/messages/text-message.renderer.ts`, `mk/sending/text-dispatch.service.ts`,
      `mk/messages/dto/text-message.dto.ts`. Test: recipients without consent skipped.
- [ ] **T17**. `mk/tracking/`: consumer of the communications delivery and tracking events (opens, clicks per link,
      unsubscribes, bounces, complaints, stop keywords) into aggregates on sends and links, parameters on own domains,
      automatic opens, list cleaning on bounce and complaint, text marketing ended on a stop keyword, conversions within
      the window as touches, party stats, timeline source; results routes `/marketing/messages/:id/{results,links,
      recipients,recipients.csv}` (`mk/tracking/marketing-results.controller.ts`, `mk/tracking/engagement.worker.ts`).
      Test: aggregates match the events; employee recipients untracked; no tracking route in this plugin; the CSV
      export lists each recipient's state and engagement.
- [ ] **T18**. `mk/sequences/`: flow template `marketing.sequence`, actions and triggers registered with automation,
      enrolment with refusals, end dates, steps added later, ending on unsubscribe. Test: each FR-47 refusal; a step
      added on day 5 reaches day-7 enrolments.
- [ ] **T19** (parallel). `mk/videos/`: video records, `registerVideoMetricsAdapters`, refresh frequencies, daily stats,
      typed figures without an adapter. Test: refresh with a test adapter; failure recorded without stopping others.
- [ ] **T20**. Events on the outbox (plan §5), realtime counters, record types for campaigns, messages, lists and segments.
      Files: `mk/events/marketing.events.ts`, `mk/realtime/marketing-realtime.publisher.ts`,
      `mk/record-types/marketing-record-types.ts`. Test: events carry ids only; counters reach an open page within 5 s.
- [ ] **T36**. Feature gate: `@FeatureFlag(FEATURE_CAMPAIGNS)` on every staff, public and portal controller of the
      plugin, menu entries and portal area registered only with the flag on, MCP tools refused while it is off. Files:
      `mk/campaigns.features.ts`, `mk/campaigns/marketing-campaign.controller.ts`, `mk/lists/public-subscribe.controller.ts`,
      `mk/specs/campaigns-feature-gate.e2e.spec.ts`. Test: e2e, with the flag off every staff, public and portal route
      answers `404`; with `GAUZY_CAMPAIGNS_ENABLED` unset the plugin is not listed.
- [ ] **T37**. Re-permission: `marketing.repermission` daily job listing consents older than the organization's period,
      `/marketing/repermission/{candidates,messages}` building a `REPERMISSION` message, and marketing stopped for people
      who do not confirm when the organization says so. Files: `mk/consent/repermission.service.ts`,
      `mk/consent/repermission.controller.ts`, `mk/consent/marketing-repermission.scheduler.ts`. Test: a consent older
      than 24 months is a candidate; with the stop setting on, an unconfirmed person is skipped at the next send.
- [ ] **T38**. Marketing-purpose record and bulk emails: a recipient filter offered to the communications composer and
      bulk send for purpose `MARKETING` that drops addresses suppressed or unsubscribed from all marketing and returns
      who was dropped. Files: `mk/consent/marketing-recipient-filter.ts`, `apps/api/src/plugin-composition.ts`. Test: a
      record email to an unsubscribed address is dropped and the sender is told who was dropped (spec AC-3).
- [ ] **T39**. GraphQL reads `marketingCampaigns`, `marketingCampaign`, `marketingMessages`, `marketingLists`,
      `marketingSegments` with cursor paging, and `Idempotency-Key` on the schedule, send, enrol, subscribe and import
      routes. Files: `mk/graphql/marketing-campaign.resolver.ts`, `mk/graphql/marketing-message.resolver.ts`,
      `mk/graphql/marketing-audience.resolver.ts`, `mk/graphql/types.ts`, `mk/idempotency/marketing-idempotency.interceptor.ts`.
      Test: resolver specs under the caller's permissions; a repeated key returns the first result without a second
      send.

## Phase 3 — UI surfaces

- [ ] **T21**. `ui/campaigns/`: the one Campaigns menu entry, list as saved view of the campaign records, campaign page
      tabs, costs, members, results, promotions and coupons; i18n `MARKETING.*` in every locale. Test: rendering specs;
      one campaign entry in the menu.
- [ ] **T22**. `ui/messages/`: editor modes, token picker, audience builder with live counts and skips, schedule,
      test and checks, previews, approval, live sending panel, results and click map. Test: rendering and keyboard specs.
- [ ] **T23** (parallel). `ui/lists/`, `ui/segments/` (condition builder, sample), `ui/videos/`, `ui/settings/`; Marketing tab
      on contact and person pages. Test: rendering specs.
- [ ] **T24**. Built-in public pages in `public-sections`: web version of a message and the confirmation result (the
      unsubscribe and preference pages are communications'). Files:
      `ui/public/marketing-web-version.component.ts`, `ui/public/marketing-confirmation.component.ts`,
      `ui/public/marketing-public.routes.ts`. Test: rendering specs; invalid link page.
- [ ] **T25** (parallel). `ui/portal/`: newsletter preferences as an Angular area mounted through the portal's
      `portal-sections` child routes; portal route `/portal/marketing/subscriptions`. Test: rendering tests; another
      party's lists never shown.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T26**. MCP `packages/mcp-server/src/lib/tools/marketing.ts` (plan §7). Test: schedule refused without a preview's
      confirmation id.
- [ ] **T27**. Report datasets and definitions of spec FR-83, listed as core `report` rows of a "Marketing" category
      with `featureKey` `FEATURE_CAMPAIGNS` (the shared catalogue feature filter of `report-builder-and-dashboards`, guarded
      so that it is safe from any feature). Files: `mk/reports/definitions/*.ts` (one per report of FR-83),
      `mk/reports/marketing-report-datasets.ts`,
      `mk/database/migrations/1791000052730-SeedMarketingReportCatalogue.ts`. Test: seeded tenant rows per report; with
      the flag off the report list and menu are unchanged.
- [ ] **T28**. Port bindings in `apps/api/src/plugin-composition.ts`, the import template for list members, and the
      public subscribe, confirm and feed routes published as their own OpenAPI group (with a sample of the site footer
      call for Ever Works templates). Test: composition spec with and without communications.
- [ ] **T29**. OpenAPI regenerated, SDK regeneration noted; user docs (lists, newsletters, campaigns, sequences, consent);
      `docs/specs/README.md` row. Test: docs build.

## Phase 5 — Advanced capabilities (plan phase 3)

- [ ] **T30**. Send-time optimisation: nightly best hour, due times within the window, comparison in results. Files:
      `mk/send-time/best-hour.service.ts`, `mk/send-time/marketing-send-time.scheduler.ts`,
      `mk/sending/plan.service.ts`, `mk/tracking/marketing-results.controller.ts`. Test: recipients without history get
      the scheduled time; results compare optimised and scheduled recipients.
- [ ] **T31**. Experiments and holdout: variants, test share, decision job with significance, winner dispatch, holdout
      in planning, lift in results. Files: `mk/experiments/marketing-experiment.service.ts`,
      `mk/experiments/marketing-experiment.controller.ts`, `mk/experiments/significance.ts`,
      `mk/experiments/marketing-experiments.scheduler.ts`, `mk/sending/plan.service.ts`. Test: no clear winner falls back
      to the first variant with the reason; held-out recipients receive nothing and the lift is shown.
- [ ] **T32**. Revenue attribution: touches, models, window, document flow through `MARKETING_DOCUMENT_FLOW`, attributed
      paid revenue in the organization currency, time cost through `MARKETING_TIME_COST`. Files:
      `mk/attribution/attribution-models.ts`, `mk/attribution/marketing-attribution.worker.ts`,
      `mk/attribution/campaign-time-cost.ts`, `mk/campaigns/marketing-campaign.controller.ts` (`/:id/attribution`). Test:
      one paid invoice split under each model sums to its amount; return on spend includes tracked time.
- [ ] **T33**. Consent ledger: `terms_acceptance` evidence for every grant and the communications consent record for
      every withdrawal, consent or basis on every send, proof file export. Files: `mk/consent/consent-ledger.service.ts`,
      `mk/consent/consent-proof-file.ts`, `mk/consent/marketing-consent.controller.ts` (`/consent.zip`). Test: each send
      names its consent; export lists every marketing message.
- [ ] **T34** (parallel). Assistant through `MARKETING_ASSISTANT` on the agent runtime of `ai-agents-and-assistants`
      (usage and budgets recorded there): subject, preview and body variants with spam-risk notes, sentence to segment
      `rule` rows with live count; no personal values in prompts; gated by `FEATURE_CAMPAIGNS_ASSISTANT`. Files:
      `mk/assistant/marketing-assistant.service.ts`, `mk/assistant/marketing-assistant.controller.ts`,
      `ui/messages/assistant-panel.component.ts`. Test: drafts never scheduled; prompt payload check.
- [ ] **T35**. Benchmarks: segment count at one million contacts, planning 500,000 recipients, hand-over rate, redirect
      latency. Files: `mk/benchmarks/segment-count.bench.spec.ts`, `mk/benchmarks/plan-recipients.bench.spec.ts`,
      `mk/benchmarks/handover-rate.bench.spec.ts`. Test: budgets of spec §4 met on PostgreSQL and MySQL.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Scope, flags and compatibility | T2, T7, T36 |
| FR-2 | §3.1 Scope, flags and compatibility | T3, T8, T9 |
| FR-3 | §3.1 Scope, flags and compatibility | T14, T15 |
| FR-4 | §3.1 Scope, flags and compatibility | T3 |
| FR-5–FR-8 | §3.2 Campaigns | T8 |
| FR-9 | §3.2 Campaigns | T9 |
| FR-10 | §3.2 Campaigns | T8, T21 |
| FR-11 | §3.2 Campaigns | T8 |
| FR-12–FR-16 | §3.3 Subscription lists and sign-up | T10 |
| FR-17 | §3.3 Subscription lists and sign-up | T10, T23 |
| FR-18 | §3.3 Subscription lists and sign-up | T25 |
| FR-19 | §3.4 Consent, unsubscribe and suppression | T11, T15 |
| FR-20 | §3.4 Consent, unsubscribe and suppression | T11 |
| FR-21 | §3.4 Consent, unsubscribe and suppression | T11, T33 |
| FR-22 | §3.4 Consent, unsubscribe and suppression | T17 |
| FR-23 | §3.4 Consent, unsubscribe and suppression | T11, T23 |
| FR-24 | §3.4 Consent, unsubscribe and suppression | T37 |
| FR-25 | §3.5 Audiences and segments | T12, T23 |
| FR-26–FR-27 | §3.5 Audiences and segments | T12 |
| FR-28 | §3.5 Audiences and segments | T14, T22 |
| FR-29 | §3.6 Messages and newsletters | T13, T22 |
| FR-30–FR-31 | §3.6 Messages and newsletters | T13 |
| FR-32 | §3.6 Messages and newsletters | T13, T22 |
| FR-33 | §3.6 Messages and newsletters | T13 |
| FR-34 | §3.6 Messages and newsletters | T13, T22 |
| FR-35–FR-36 | §3.6 Messages and newsletters | T13 |
| FR-37 | §3.6 Messages and newsletters | T14 |
| FR-38 | §3.6 Messages and newsletters | T14 |
| FR-39 | §3.6 Messages and newsletters | T15 |
| FR-40 | §3.6 Messages and newsletters | T16 |
| FR-41 | §3.6 Messages and newsletters | T20, T22 |
| FR-42 | §3.7 Sending rules | T14, T15 |
| FR-43 | §3.7 Sending rules | T38 |
| FR-44 | §3.7 Sending rules | T15, T16 |
| FR-45 | §3.7 Sending rules | T15 |
| FR-46–FR-49 | §3.8 Campaign sequences | T18 |
| FR-50 | §3.8 Campaign sequences | T8, T17, T18 |
| FR-51 | §3.8 Campaign sequences | T18 |
| FR-52–FR-53 | §3.9 Tracking | T15, T17 |
| FR-54 | §3.9 Tracking | T17 |
| FR-55 | §3.9 Tracking | T17, T23 |
| FR-56 | §3.9 Tracking | T9, T17 |
| FR-57 | §3.9 Tracking | T17 |
| FR-58 | §3.10 Results | T17, T22 |
| FR-59 | §3.10 Results | T8, T21 |
| FR-60 | §3.10 Results | T17 |
| FR-61 | §3.11 Video content | T5, T19 |
| FR-62 | §3.11 Video content | T19 |
| FR-63–FR-64 | §3.12 Send-time optimisation (advanced) | T30 |
| FR-65–FR-67 | §3.13 Experiments and holdout (advanced) | T31 |
| FR-68–FR-70 | §3.14 Revenue attribution and cost (advanced) | T32 |
| FR-71–FR-73 | §3.15 Consent ledger (advanced) | T33 |
| FR-74–FR-75 | §3.16 Campaign assistant (advanced) | T34 |
| FR-76 | §3.17 Settings, roles and real time | T2, T8, T23 |
| FR-77 | §3.17 Settings, roles and real time | T6 |
| FR-78 | §3.17 Settings, roles and real time | T20, T22 |
| FR-79 | §3.18 API, MCP and events | T39 |
| FR-80 | §3.18 API, MCP and events | T20 |
| FR-81 | §3.18 API, MCP and events | T26 |
| FR-82 | §3.18 API, MCP and events | T20 |
| FR-83 | §3.19 Reports | T27 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off for existing tenants; enabling it in dev shows the feature end to end; spec AC-17 holds with
  the flag off and on.
- Constitution gates in `spec.md` §9 confirmed.
- No marketing message reaches a suppressed, unsubscribed, do-not-contact or non-consenting address (contract test green).
- Promotion campaigns and transactional mail behave as before (existing suites green).
- Every `(advanced)` requirement has its acceptance criterion passing.
