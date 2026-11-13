# Ever Gauzy specs

Spec-driven development for the platform, following the
[GitHub Spec Kit](https://github.com/github/spec-kit) workflow adapted in
[`.specify/`](../../.specify/README.md). The constitution
([`.specify/memory/constitution.md`](../../.specify/memory/constitution.md)) is the
highest-priority document: every spec, plan and task list reconciles with it.

```text
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
| Real-time channel (collaboration events on the outbox, presence, typing, subscription) | [`features/realtime-channel/`](features/realtime-channel/spec.md) | Merged (#11681) — dev verification open | `GAUZY_REALTIME_ENABLED` |
| Chat (channels, direct messages, threads, mentions, reactions, task cards) | [`features/chat/`](features/chat/spec.md) | Phase 1 merged (#11683, #11686); Angular UI in review (#11687) | `GAUZY_CHAT_ENABLED` |
| Inbox (unified notifications, triage, preferences, push) | [`features/inbox/`](features/inbox/spec.md) | Unified inbox merged (#11682); email/push/settings open | `GAUZY_INBOX_ENABLED` |
| Docs collaboration (spaces, live co-editing, notifications, Markdown export and API editing) | [`features/docs-collaboration/`](features/docs-collaboration/spec.md) | Phase 1 in review (`feat/docs-collaboration`) — [`plan`](features/docs-collaboration/plan.md) · [`tasks`](features/docs-collaboration/tasks.md) | `GAUZY_DOCS_COLLAB_ENABLED` |
| Tasks: saved views, bulk actions, keyboard-first lists | [`features/task-views-and-bulk-actions/`](features/task-views-and-bulk-actions/spec.md) | Phase 1 in review ([#11688](https://github.com/ever-co/ever-gauzy/pull/11688)) — [`plan`](features/task-views-and-bulk-actions/plan.md) · [`tasks`](features/task-views-and-bulk-actions/tasks.md) | `GAUZY_TASK_VIEWS_ENABLED` |
| Integrations: Linear, Asana, Trello (import and sync) | [`features/integrations-asana-linear-trello/`](features/integrations-asana-linear-trello/spec.md) | Phase 1 merged for Linear, Asana and Trello; manual checks on dev outstanding — [`plan`](features/integrations-asana-linear-trello/plan.md) · [`tasks`](features/integrations-asana-linear-trello/tasks.md) | `LINEAR_ENABLED`, `ASANA_ENABLED`, `TRELLO_ENABLED` |
| Docs import (Markdown vault, HTML export zip) and PDF export | [`features/docs-import-export/`](features/docs-import-export/spec.md) | In progress (`feat/docs-import-export`) — [`plan`](features/docs-import-export/plan.md) · [`tasks`](features/docs-import-export/tasks.md) | `GAUZY_DOCS_IMPORT_ENABLED`, `GAUZY_DOCS_PDF_EXPORT_ENABLED` |
| Chat incoming webhooks (bots and automation posts) | [`features/chat-incoming-webhooks/`](features/chat-incoming-webhooks/spec.md) | Draft | `GAUZY_CHAT_WEBHOOKS_ENABLED` |
| Comments and trash (reactions on comments, edit marker, task trash) | [`features/comments-and-trash/`](features/comments-and-trash/plan.md) (client spec in ever-teams) | In review ([#11802](https://github.com/ever-co/ever-gauzy/pull/11802)) — [`plan`](features/comments-and-trash/plan.md) · [`tasks`](features/comments-and-trash/tasks.md) | `GAUZY_TASK_TRASH_ENABLED` |
| MCP tools for chat, docs and inbox | [`features/mcp-collaboration-tools/`](features/mcp-collaboration-tools/spec.md) | In Progress (ever-gauzy #11722: the three groups, switches and scopes; assisted marker and session-recorded scopes open) | MCP server config |

Statuses: `Draft` → `In Review` → `Approved` → `Implemented` → `Retrospective`.

## Decisions

| ADR | Decision |
| --- | -------- |
| [`decisions/001-collaboration-api-lives-in-plugins.md`](decisions/001-collaboration-api-lives-in-plugins.md) | New collaboration capabilities ship as plugins with one API consumed by every client |

## Scaffolding a new feature

```bash
bash .specify/scripts/bash/create-new-feature.sh <slug> "Feature Title"
# or, in PowerShell 7:
pwsh -File .specify/scripts/powershell/create-new-feature.ps1 -Slug <slug> -Title "Feature Title"
```

The slug is one lower-case directory name (`a-z`, `0-9`, `-`, at most 64 characters); see
[`.specify/README.md`](../../.specify/README.md) for the prerequisites check.
