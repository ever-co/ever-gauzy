# ADR 001 — Collaboration capabilities ship as plugins with one API for every client

**Status**: Accepted
**Date**: 2026-11-07
**Deciders**: platform maintainers

## Context

The platform is consumed by several clients: the Angular web app, Ever Teams (Next.js
web, React Native mobile, Electron desktop, browser extensions), the desktop timer apps,
the MCP server and the Kiota-generated SDKs. Tasks, comments, mentions, employee
notifications, documents (file attachments), a knowledge base and third-party
integrations already exist as core modules or plugins. The collaboration suite adds Chat,
a unified Inbox, Docs as collaborative pages, a real-time push channel, saved task views,
bulk actions and three more integrations (Asana, Linear, Trello).

Two questions had to be settled before any code: **where** the new capabilities live
(core vs plugin) and **how many** implementations of each behaviour exist (one per client
or one shared).

## Decision

1. **One API, built once, in the platform.** Every collaboration capability is a REST
   surface (plus events on the platform event bus and, where needed, MCP tools) in this
   repository. Clients never hold collaboration data of their own: Ever Teams, the Angular
   app, mobile and desktop are views over the same endpoints.
2. **New capabilities are plugins** under `packages/plugins/`:
   - `realtime` — the push channel (WebSocket gateway, presence, typing, replayable
     event stream) that every other feature publishes to;
   - `chat` — conversations, messages, threads, reactions, pins, unread state, webhooks;
   - `inbox` — the unified notification inbox built on the existing employee
     notification entity (read/unread/archive/snooze, grouping, channel preferences);
   - `docs-pages` — pages, page tree, versions, anchored comments, exports, built next
     to the existing `docs` (files) and `knowledge-base` plugins;
   - `integration-asana`, `integration-linear`, `integration-trello` — following the
     existing `integration-github` / `integration-plane` layout, each with its `-ui`
     package.
   Shared, cross-cutting pieces that several plugins and the core domain need
   (comments, mentions, employee notifications, task views, bulk task operations,
   activity log) stay in `packages/core` and are extended there.
3. **Contracts first.** Interfaces, enums and DTO shapes land in `@gauzy/contracts`
   before services and UI, so that Ever Teams, the SDKs and the MCP server can be built
   against them in parallel.
4. **Default-off flags, additive migrations, both ORMs** — as the constitution requires.
   A plugin that is not enabled in `apps/api/src/plugins.ts` adds no tables, routes or
   behaviour.

## Consequences

- Ever Teams gets Chat, Docs and Inbox by consuming the platform API; it builds UI only.
  Its specs reference the platform specs by slug.
- The Angular app gets the same features through `-ui` plugins registered with
  `@gauzy/plugin-ui` (or `-react-ui` plugins through `@gauzy/ui-react`).
- A capability is reachable through the SDKs and the MCP server as soon as its API
  merges, before any UI exists.
- Plugins depend on core and on `@gauzy/contracts`, never on each other's internals; chat
  reaches tasks through the task service and public events, not through imports of the
  task module's private files.
- The real-time plugin is a prerequisite for chat and inbox live updates; both must keep
  working with polling when it is disabled (documented fallback, no private sockets).
