# Task Breakdown: Helpdesk portal and knowledge base

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `helpdesk-portal-and-knowledge-base`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind the feature flag: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
- Starts after the `documents-and-wiki` tables (spaces, routes, feedback, view statistics) and `helpdesk-tickets` T1 to T12.
- Paths: `dh/` = `packages/plugins/docs/src/lib/help/`, `dui/` = `packages/plugins/docs-ui/src/lib/help/`,
  `kb/` = `packages/plugins/knowledge-base/src/lib/`, `hd/` = `packages/plugins/helpdesk/src/lib/`,
  `hdui/` = `packages/plugins/helpdesk-ui/src/lib/`.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts: help module additions in `help-center.model.ts` (audience, help node, sources, outcomes, states),
      `helpdesk-satisfaction.model.ts`, `IHelpKnowledge`, `IHelpdeskSatisfaction`, `IPortalBranding`,
      `IKnowledgeBaseExport`, events; `FeatureEnum` gains the three features. Test: contract shape spec.
- [ ] **T2**. `dh/` module scaffold: feature and permission contributions with `defaultFor` (plan §9), setting
      contributions `dh/help.settings.ts`; `KNOWLEDGE_BASE_EXPORT` provider in `kb/` (read only), the
      `knowledge_base.article.changed` event and the `KNOWLEDGE_BASE_SYNC` write-back in `kb/` (existing routes and their
      answers unchanged). Test: catalogue specs; the export lists every help centre, category, article and version once;
      existing knowledge-base suites green.
- [ ] **T3**. Additive columns `document.audience`, `document_space.purpose` (one help space per organization),
      `document_feedback.reason` and
      `1791000052600-AddHelpColumnsToDocuments` in the docs plugin's `database/`. Test: migration on SQLite after the
      `documents-and-wiki` migrations and refused before them; ORM parity; existing docs specs green. Migration timestamps: `1791000052600` to `1791000052649` (`packages/plugins/docs`); `1791000052650` to `1791000052699` (`packages/plugins/helpdesk`).
- [ ] **T4**. Entities help node, search log, synonym set and `1791000052610-CreateHelpTables`. Test: migration on three
      dialect branches; one help node per document.
- [ ] **T5** (parallel). Entities gap, assistant answer, community question and `1791000052620-CreateHelpBeyondTables`.
      Test: as T4.
- [ ] **T6**. Helpdesk entities rating option, request, rating and `1791000052650-CreateHelpdeskSatisfactionTables`;
      `1791000052660-SeedHelpdeskRatingTemplates`; rating setting contributions in `hd/helpdesk.settings.ts`. Test: as T4;
      one rating per ticket and cycle.
- [ ] **T7**. `dh/import/help-center.importer.ts`: a docs import run over `KNOWLEDGE_BASE_EXPORT` into the organization's
      one help space (a folder per help centre, folders per category at every legacy depth, the help centre's language on
      each page), pages with versions (`externalSource = 'help-center'`), visibility from `privacy`, audience null (today's readers),
      project links; nothing written to the legacy rows; the two-way carry (`knowledge_base.article.changed` applied to
      the page, page saves written back through `KNOWLEDGE_BASE_SYNC` in `kb/`, provenance stopping the echo), ordered by
      the legacy version in `help_node.legacySyncedAt` (stale events dropped, conditional write-back; plan §3). Test:
      re-run imports nothing twice; no imported page readable by a guest; legacy rows unchanged after the import
      (`isLocked` included); a legacy write reaches the page and a page save reaches the legacy row once; a delayed event of
      legacy version A arriving after a page save wrote B to the page and the legacy row is dropped and both keep B; a
      write-back that meets a newer legacy write writes nothing and that write becomes the page's next version; a three-level
      category tree arrives with three levels.

## Phase 2 — Services, endpoints, events

- [ ] **T8**. `dh/lifecycle/`: publish now or later, unpublish, archive, restore as draft, slug rules on the document slug
      with former routes kept, cited-delete guard, bulk through the core bulk executor with per-row results, content
      sanitised on save; help checks on the existing docs routes for help pages and folders only. Test: each transition;
      `HELP_ARTICLE_CITED` with count; a page of the marked space without a help node keeps today's rights and delete
      behaviour; a script in saved content is removed.
- [ ] **T9**. `dh/access/help-audience.filter.ts` applied to every read path (lists, counts, retrieval filters, suggestions,
      related, Markdown, feeds, read API); category caps and narrowing on move. Test: audience contract kit
      (`dh/testing/audience.contract.ts`) as guest, integration token, customer and agent over every path.
- [ ] **T10**. `dh/categories/`: nested folders (as deep as the legacy tree; first two levels in the home data), slugs,
      merge, move articles, delete with summary to General, pins. Test: General cannot be deleted; a merged category's
      former slug resolves.
- [ ] **T11**. `dh/settings/`: help settings, portal branding draft, preview link, publish, `PORTAL_BRANDING` provider with
      organization fallback; default content per new help space. Test: preview token staff-only; fallback to the
      organization's brand colour and logo.
- [ ] **T12**. `dh/public/`: public read API and feeds (home data, categories, article, Markdown twin, feed JSON and RSS,
      former slug resolution), caching headers with validators, throttles, portal key resolution, integration tokens of
      the Ever Works integration; content sanitised on render, embedded files served only through the platform's file
      routes; every route answers `404` while `FEATURE_HELPDESK_PORTAL` is off and keeps answering guests while portal
      sign-in is off; shared caching only for `EVERYONE` answers (plan §4). Test: e2e as guest and with an integration token;
      404 outside the audience; 404 with the flag off; a guest answer carries `Cache-Control: public, max-age=60` and
      `Vary: Authorization, Cookie`, an answer to a portal session `private, no-store`, so a customer-only article never
      reaches a guest through a shared cache; after an article is unpublished, archived or narrowed to customers, the
      next guest answer from the platform leaves it out (`404` for the article) and an answer given before carried at
      most `max-age=60`.
- [ ] **T13**. `dh/search/`: `HelpSearchService` over `DOCS_KNOWLEDGE_SEARCH_SERVICE` filtered to help spaces, audience,
      language and published state, synonyms and ignored words expanded before the call, field weights on the merged
      result, search log, index check through the docs knowledge queue with progress. Test: title match first; synonym
      expansion; lexical fallback without embeddings.
- [ ] **T14** (parallel). `dh/search/sources/`: platform record type sources and outside sources through
      `createSsrfSafeHttpsAgent()` with allow-list, timeout and grouping. Test: timeout leaves the group out; private range
      refused.
- [ ] **T15**. `dh/feedback/` and `dh/stats/`: votes into `document_feedback` with limits and `PUBLIC_FORM_DEFENCE`, view
      beacons into `document_view_stat`, cached counters on help nodes, author figures. Test: one vote per browser and
      day; staff previews not counted.
- [ ] **T16**. `dh/suggest/`: `HELPDESK_KNOWLEDGE` binding (suggest, get, cite), related articles, citations as
      `document_link` rows from sent messages. Test: suggestions respect the customer audience; one link per article and
      ticket with its kinds.
- [ ] **T17** (parallel). Signed-in help routes `/portal/help/*` over the audience filter for portal sessions
      (`help.customer_articles`) and the help site address setting the portal links to. Files:
      `packages/plugins/docs/src/lib/help/portal/portal-help.controller.ts`, `dh/portal/portal-help.service.ts`. Test: a
      customers-only article is readable signed in and `404` as a guest.
- [ ] **T18**. `hd/portal/`: customer ticket routes over `HELPDESK_TICKETS` (list mine and organisation, form schema,
      create with arrival fields, read, reply, solved), customer choice for several customers (one customer set at
      once), guest follow-up through its `shared_entity` link, organisation figures over `HELPDESK_CUSTOMER_STATS`; every
      route answers `404` while `FEATURE_HELPDESK_PORTAL`, `FEATURE_HELPDESK` or `FEATURE_CUSTOMER_PORTAL` is off.
      Files: `hd/portal/portal-tickets.controller.ts`, `hd/portal/portal-tickets.service.ts`,
      `hd/portal/guest-follow-up.controller.ts`, `hd/portal/portal-organisation-figures.service.ts`. Test: cross-customer
      404; closed field 400; reply reopens; 404 with each flag off.
- [ ] **T19**. `hd/satisfaction/`: options, requests on entering the chosen status with a `shared_entity` rating link,
      score from the email's star link selected on the rating page and recorded by its `POST` (never by the `GET`), rating page data, finality per cycle, auto-close hold, `HELPDESK_SATISFACTION` provider, ratings
      list with filters and CSV export (`/helpdesk/ratings`, `/export.csv`). Files:
      `hd/satisfaction/rating-request.service.ts`, `hd/satisfaction/rating.service.ts`,
      `hd/satisfaction/public-rating.controller.ts`, `hd/satisfaction/ratings.controller.ts`,
      `hd/satisfaction/rating-options.controller.ts`. Test: one request per resolution; second use shows the recorded
      rating; opening a star link records nothing until the page's Send; held auto-close released after N days; the export lists the filtered ratings.
- [ ] **T20**. Customer organisation tools: public email domain setting, suggestion filter, bulk organisation access as a
      core operation, delete with tickets option on customer and person pages. Files:
      `hd/customers/organisation-access.operation.ts`, `hd/customers/member-suggestions.ts`,
      `hd/customers/organisation-access.controller.ts`, `hdui/customers/customer-tickets-tab.component.ts`,
      `hdui/customers/delete-with-tickets-dialog.component.ts`. Test: public domains never suggested; the bulk access
      runs as an operation with progress.
- [ ] **T21**. Events (plan §5), automation triggers, record types, portal areas and rights with defaults per membership
      role, report rows of FR-87 in the core report catalogue behind the shared catalogue feature filter of
      `report-builder-and-dashboards` (rows keyed `FEATURE_HELPDESK_PORTAL` in the shared "Support" category). Files:
      `dh/events/help.events.ts`, `dh/automation/help-automation-triggers.ts`, `dh/record-types/help-record-types.ts`,
      `hd/portal/portal-ticket-rights.ts`,
      `packages/plugins/docs/src/lib/database/migrations/1791000052630-SeedHelpReportCatalogue.ts`. Test: events carry
      ids only; triggers listed in the automation catalogue; a new purchaser membership gets the ticket rights; with the
      flag off the report list and menu are unchanged.
- [ ] **T38** (parallel). GraphQL reads `helpArticles(filter)`, `helpArticle` and `helpdeskRatings(filter)` over the
      audience filter and the rating permissions. Files: `dh/graphql/help-article.resolver.ts`,
      `hd/graphql/helpdesk-rating.resolver.ts`. Test: resolver specs; an agents-only article is absent for a customer.

## Phase 3 — UI surfaces

- [ ] **T22**. `dui/`: help fields on pages and folders of a help space (audience, excerpt counter, pins, publish date),
      lifecycle actions, bulk bar, category tools, stats and citations panel; the help-center page and its redirect guard
      unchanged. Test: rendering specs; the guard still sends the help-center page to the Documents hub.
- [ ] **T23**. The help site contract: OpenAPI group for the public help routes with examples, Markdown twins, and a
      contract suite a help site (an Ever Works template included) can run (home data, article, search, feedback, former
      slug, feed). Files: `packages/core/src/lib/bootstrap/swagger.ts`. Test: the suite passes against a seeded tenant.
- [ ] **T24** (parallel). `dui/` help space tabs: audiences, search settings, synonyms, sources, analytics; portal branding
      editor with preview on the portal settings page. Test: rendering specs; unsaved-change guard.
- [ ] **T25**. `hdui/portal/`: signed-in Help page (customer and everyone articles, search, recent items, link to the help
      site), Tickets list with saved views, new ticket form with live suggestions and deflection, ticket page with layout
      switch and outside-hours message, organisation figures, rating step; the built-in rating and follow-up pages in
      `public-sections`; ticket pages refreshed within 2 s on the member's `helpdesk.*` hints; "New request" hidden when
      the organization says so. Test: rendering specs; new messages announced to screen readers; an agent reply shows
      within 2 s.
- [ ] **T26** (parallel). `hdui/` agent side: related articles panel, insert article, draft an article from a ticket,
      ratings in the requester panel, ratings settings and list. Test: rendering specs.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T27**. MCP `packages/mcp-server/src/lib/tools/help-center.ts` and `helpdesk.ts` additions (plan §7). Test: tool
      specs; drafts never published.
- [ ] **T28**. Report sources and views of spec FR-87 behind the Support report rows. Files:
      `dh/reports/help-report-datasets.ts`, `dh/reports/definitions/*.definition.ts` (one per report of FR-87),
      `hd/satisfaction/ratings-report.definition.ts`. Test: seeded tenant rows per report.
- [ ] **T29**. Port bindings in `apps/api/src/plugin-composition.ts` (`HELPDESK_KNOWLEDGE`, `HELPDESK_SATISFACTION`,
      `PORTAL_BRANDING`, `HELP_CENTER_ASSISTANT`, `KNOWLEDGE_BASE_EXPORT`). Test: composition spec with and without each
      owner.
- [ ] **T30**. OpenAPI regenerated, SDK regeneration noted; user docs (help spaces, articles, help sites, ratings);
      `docs/specs/README.md` row. Test: docs build.

## Phase 5 — Advanced capabilities (plan phase 3)

- [ ] **T31**. `dh/assistant/`: retrieval through the docs pipeline over the reader's audience, answer with sources,
      threshold refusal, hand-over to the ticket form with context, feedback, guest limits; runs of the purpose
      `help.assistant` with `ai_usage_entry` and its `ai_budget`. Test: an agents-only article never reaches the prompt of
      a guest; below-threshold refusal; budget refusal.
- [ ] **T32**. `dh/gaps/`: nightly clustering of signals with the docs embeddings, topics with volume and examples, assign,
      dismiss, draft through the assistant as a help page, resolution on publication. Test: seeded zero-result searches
      form one topic; publishing resolves it.
- [ ] **T33**. `dh/variants/`: translations with the confirmed source revision, stale flags with changed sections, reader
      fallback and notice, release ranges, releases for the picker, release start copying drafts. Test: source edit flags
      every translation; the read API gives the right variant.
- [ ] **T34**. `dh/community/` and `hdui/portal/community/`: questions, answers as core comments on the question, votes as
      reactions, acceptance, moderation queue, reports, conversion to a help page draft or ticket, limits, published
      threads in the read API. Test: sanitised posts; conversion links back.
- [ ] **T35** (parallel). Rating recovery: threshold, team lead task, inbox notice, trigger "low rating received". Files:
      `hd/satisfaction/rating-recovery.service.ts`, `hd/satisfaction/rating-recovery.listener.ts`. Test: a two-star rating
      creates one task.
- [ ] **T36**. Benchmarks: search at 50,000 articles, read API caching, ticket list at 20,000 tickets per customer. Files:
      `dh/benchmarks/help-search.bench.spec.ts`, `dh/benchmarks/help-read-api.bench.spec.ts`,
      `hd/benchmarks/portal-ticket-list.bench.spec.ts`. Test: budgets of spec §4 met on PostgreSQL and MySQL.
- [ ] **T37**. Provide the ports other features bind to (plan, **Consumer tokens answered**): `HELP_CENTRE_ARTICLES`. Files: `apps/api/src/plugin-composition.ts`. Test: one contract test per token over the shape its consumer plan states; with this feature off each consumer keeps its stated fallback.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Scope, flags and compatibility | T2, T12, T18, T27 |
| FR-2 | §3.1 Scope, flags and compatibility | T2, T7 |
| FR-3 | §3.1 Scope, flags and compatibility | T18 |
| FR-4 | §3.1 Scope, flags and compatibility | T3 |
| FR-5 | §3.2 Help centre and public help site | T11, T24 |
| FR-6 | §3.2 Help centre and public help site | T11, T24 |
| FR-7 | §3.2 Help centre and public help site | T12, T17 |
| FR-8 | §3.2 Help centre and public help site | T12, T23 |
| FR-9 | §3.2 Help centre and public help site | T12 |
| FR-10 | §3.2 Help centre and public help site | T8, T10, T12 |
| FR-11 | §3.2 Help centre and public help site | T25 |
| FR-12 | §3.2 Help centre and public help site | T25 |
| FR-13 | §3.2 Help centre and public help site | T11 |
| FR-14–FR-16 | §3.3 Categories | T10 |
| FR-17 | §3.3 Categories | T9, T10 |
| FR-18 | §3.3 Categories | T10 |
| FR-19 | §3.4 Articles and editor | T8, T22 |
| FR-20–FR-21 | §3.4 Articles and editor | T8 |
| FR-22 | §3.4 Articles and editor | T10, T22 |
| FR-23 | §3.4 Articles and editor | T8 |
| FR-24 | §3.4 Articles and editor | T8 |
| FR-25 | §3.4 Articles and editor | T8, T12 |
| FR-26 | §3.5 Access | T3, T9 |
| FR-27 | §3.5 Access | T9 |
| FR-28 | §3.5 Access | T11, T15, T25 |
| FR-29 | §3.6 Article page and feedback | T12, T16, T25 |
| FR-30 | §3.6 Article page and feedback | T12, T17, T23 |
| FR-31–FR-33 | §3.6 Article page and feedback | T15 |
| FR-34–FR-35 | §3.7 Search | T13 |
| FR-36 | §3.7 Search | T14 |
| FR-37 | §3.7 Search | T16, T26 |
| FR-38–FR-39 | §3.7 Search | T13 |
| FR-40–FR-41 | §3.8 Customer tickets in the portal | T18, T25 |
| FR-42 | §3.8 Customer tickets in the portal | T18 |
| FR-43 | §3.8 Customer tickets in the portal | T16, T18, T25 |
| FR-44 | §3.8 Customer tickets in the portal | T18 |
| FR-45 | §3.8 Customer tickets in the portal | T18, T25 |
| FR-46–FR-47 | §3.8 Customer tickets in the portal | T18 |
| FR-48 | §3.8 Customer tickets in the portal | T18, T25 |
| FR-49 | §3.8 Customer tickets in the portal | T25 |
| FR-50 | §3.8 Customer tickets in the portal | T18, T25 |
| FR-51–FR-53 | §3.9 Satisfaction ratings | T6, T19 |
| FR-54 | §3.9 Satisfaction ratings | T19 |
| FR-55 | §3.9 Satisfaction ratings | T6, T19, T26 |
| FR-56 | §3.9 Satisfaction ratings | T19, T26 |
| FR-57 | §3.10 Customer organisations, people and membership roles | T20 |
| FR-58 | §3.10 Customer organisations, people and membership roles | T18 |
| FR-59 | §3.10 Customer organisations, people and membership roles | T21 |
| FR-60–FR-63 | §3.10 Customer organisations, people and membership roles | T20 |
| FR-64 | §3.11 Articles at work | T16, T26 |
| FR-65 | §3.11 Articles at work | T26 |
| FR-66 | §3.11 Articles at work | T16 |
| FR-67 | §3.12 Answer assistant (advanced) | T31 |
| FR-68–FR-70 | §3.12 Answer assistant (advanced) | T31 |
| FR-71–FR-73 | §3.13 Knowledge gaps (advanced) | T32 |
| FR-74–FR-77 | §3.14 Release and language variants (advanced) | T33 |
| FR-78–FR-81 | §3.15 Community questions (advanced) | T34 |
| FR-82 | §3.16 Rating recovery (advanced) | T35 |
| FR-83 | §3.17 API, MCP, events | T12, T18, T23, T38 |
| FR-84 | §3.17 API, MCP, events | T21 |
| FR-85 | §3.17 API, MCP, events | T27 |
| FR-86 | §3.17 API, MCP, events | T21 |
| FR-87 | §3.18 Reports | T21, T28 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off for existing tenants; enabling it in dev shows the feature end to end; spec AC-17 holds.
- Constitution gates in `spec.md` §9 confirmed.
- The audience contract kit passes on every read path and feed; no imported article is public after the import.
- Existing help-centre routes, their tests and the redirect guard unchanged and green.
- Every `(advanced)` requirement has its acceptance criterion passing.
