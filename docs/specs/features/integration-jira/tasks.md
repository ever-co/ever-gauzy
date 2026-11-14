# Task Breakdown: Integration — Jira Cloud

**Feature ID**: `integration-jira`
**Plan**: `./plan.md`
**Status**: `Platform in review` (ever-gauzy #11812)
**Last updated**: 2026-11-13

---

## Platform (ever-gauzy #11812)

- [x] **T1**. The sync plugin `IntegrationJiraCloudPlugin` behind `JIRA_ENABLED` (+spec), config reader (+spec), module, registration (`apps/api/src/plugins.ts` right after the Connect plugin, `apps/worker/src/plugins.ts`, `.env.sample`, the matrix spec); the Connect descriptor routes unchanged (+spec that they keep their routes and the sync declares none of them)
- [x] **T2**. OAuth 2.0 (3LO): single-use state, `POST /install/state`, public `GET /callback` (code exchanged once, `accessible-resources` read, one site chosen at once or `siteRequired`), token refresh with rotation (+spec: rotation, one renewal in flight, a renewal another process made, a refused refresh)
- [x] **T3**. Site choice: `GET /:id/sites`, `PUT /:id/site` (the former site's webhook removed)
- [x] **T4**. API client (+spec): myself, projects, project issue types and statuses, priorities, the enhanced JQL search, issue, transitions, edit, transition, create, delete, dynamic webhooks; 401 / 403 / 404 / 429
- [x] **T5**. Entities and migration `1791000008400` (postgres, mysql, sqlite): project mapping (status map, issue types, position), sync run (report), conflict, baseline; TypeORM + MikroORM repositories
- [x] **T6**. Mappings routes with the status map (categories and `status:<id>`, unknown keys refused) and the issue-type filter
- [x] **T7**. Import: streamed pages, resumable position (+spec), run report; summary, ADF description (+spec: conversion, sanitizing, round trip), status, priority, assignee by e-mail, labels, due date, parent, issue links, comments, attachments
- [x] **T8**. Webhooks: registration per connection, refresh before the 30-day expiry, re-registration, removal (+spec); `POST /webhook/:id` verification (bearer JWT) and idempotency by the delivery identifier (+spec)
- [x] **T9**. Outbound: field edit and the transition that reaches the mapped status (+spec `chooseTransition`); creation once; loop prevention
- [x] **T10**. Conflicts as for the other providers, the description compared in its Jira reading (+spec)
- [x] **T11**. Scheduled sweep in the worker: notices, webhooks, imports every `JIRA_IMPORT_INTERVAL_MINUTES` (+spec)
- [ ] **T12**. Bot threads answered; manual check against a live Jira Cloud site

## Angular (`integration-jira-ui`)

- [x] **T13**. Connect page, site choice, mappings with the status-map editor and issue types, Import now, runs with their reports, conflicts (a date-only due date shown in UTC), disconnect; an "unavailable" notice (`JIRA.UNAVAILABLE`) instead of the page when the routes answer 404 ([#11865](https://github.com/ever-co/ever-gauzy/pull/11865), [#11868](https://github.com/ever-co/ever-gauzy/pull/11868))

## Ever Teams (`integrations-settings`)

- [x] **T14**. Settings → Integrations → Jira behind `NEXT_PUBLIC_INTEGRATION_JIRA_ENABLED`: hook, services, proxy routes (both transports), section (connect, site, mappings, status map, runs, conflicts, disconnect), 13 locales, the route-surface counts ([ever-teams#5146](https://github.com/ever-co/ever-teams/pull/5146))
