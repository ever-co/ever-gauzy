# Ever Gauzy specs

Spec-driven development for the platform, following the
[GitHub Spec Kit](https://github.com/github/spec-kit) workflow adapted in
[`.specify/`](../../.specify/README.md). The constitution
([`.specify/memory/constitution.md`](../../.specify/memory/constitution.md)) is the
highest-priority document: every spec, plan and task list reconciles with it.

```
docs/specs/
├── README.md            # this index
├── architecture/        # cross-feature architecture docs
├── decisions/           # Architecture Decision Records (ADRs)
└── features/<slug>/     # spec.md (what) · plan.md (how) · tasks.md (PR-sized steps)
```

## Architecture

| Doc | Covers |
| --- | ------ |
| [`architecture/collaboration-suite.md`](architecture/collaboration-suite.md) | How Tasks, Chat, Docs, Inbox, notifications, the real-time channel and integrations fit together across the API, the Angular app, Ever Teams, the desktop apps, the MCP server and the SDKs |

## Features

| Feature | Spec | Status | Flag |
| ------- | ---- | ------ | ---- |
| Real-time channel (collaboration events on the outbox, presence, typing, subscription) | [`features/realtime-channel/`](features/realtime-channel/spec.md) | In Progress | `GAUZY_REALTIME_ENABLED` |
| Chat (channels, direct messages, threads, mentions, reactions, task cards) | [`features/chat/`](features/chat/spec.md) | Draft | `GAUZY_CHAT_ENABLED` |
| Inbox (unified notifications, triage, preferences, push) | [`features/inbox/`](features/inbox/spec.md) | Draft | `GAUZY_INBOX_ENABLED` |
| Docs collaboration (spaces, live co-editing, notifications, Markdown export and API editing) | [`features/docs-collaboration/`](features/docs-collaboration/spec.md) | Draft | `GAUZY_DOCS_COLLAB_ENABLED` |
| Tasks: saved views, bulk actions, keyboard-first lists | [`features/task-views-and-bulk-actions/`](features/task-views-and-bulk-actions/spec.md) | Draft | `GAUZY_TASK_VIEWS_ENABLED` |
| Integrations: Asana, Linear, Trello (import and sync) | [`features/integrations-asana-linear-trello/`](features/integrations-asana-linear-trello/spec.md) | Draft | per-integration tenant setting |
| Chat incoming webhooks (bots and automation posts) | [`features/chat-incoming-webhooks/`](features/chat-incoming-webhooks/spec.md) | Draft | `GAUZY_CHAT_WEBHOOKS_ENABLED` |
| MCP tools for chat, docs and inbox | [`features/mcp-collaboration-tools/`](features/mcp-collaboration-tools/spec.md) | Draft | MCP server config |

Statuses: `Draft` → `In Review` → `Approved` → `Implemented` → `Retrospective`.

## Decisions

| ADR | Decision |
| --- | -------- |
| [`decisions/001-collaboration-api-lives-in-plugins.md`](decisions/001-collaboration-api-lives-in-plugins.md) | New collaboration capabilities ship as plugins with one API consumed by every client |

## Scaffolding a new feature

```bash
.specify/scripts/bash/create-new-feature.sh <slug> "Feature Title"
```
