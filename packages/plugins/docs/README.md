# @gauzy/plugin-docs

The Ever Gauzy **Documents** backend plugin: a single hub for uploaded files, authored wiki pages
(TipTap), folders, categories, versions, links to business records, and (in later milestones) the AI
knowledge pipeline.

## Overview

- One tree, one entity: `Document` discriminated by `kind` (`FOLDER` | `PAGE` | `FILE`).
- Satellite entities: `DocumentCategory`, `DocumentVersion`, `DocumentChunk`, `DocumentIndexState`,
  `DocumentShare`, `DocumentLink`.
- HTTP API under `/api/plugins/docs/...`, guarded by `TenantPermissionGuard` + `PermissionGuard` +
  `FeatureFlagGuard` (`FeatureEnum.FEATURE_DOCUMENTS`) with per-route `DOCS_*` permissions.
- Controllers contain no business logic — every mutation dispatches a CQRS command, every read a query.
- Migrations do **not** live in this package — they ship in `packages/core/src/lib/database/migrations/`.

## ⚠️ The `Document` name-shadowing gotcha

The entity class name `Document` shadows the DOM `Document` global available in TypeScript's ambient
lib. **Always import it explicitly** (`import { Document } from './entities/document.entity';`) — a
missing import compiles silently against the DOM type and fails at runtime. The package
`eslint.config.js` carries a `no-restricted-globals` rule so a bare `Document` reference is a lint
error, not a silent DOM fallback.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `GAUZY_DOCS_MAX_FILE_SIZE` | `52428800` | Per-file upload size limit in bytes (50 MB) |
| `GAUZY_DOCS_MAX_BINARY_BYTES` | `10485760` | Cap on the PAGE `contentBinary` CRDT column (10 MB) |
| `GAUZY_DOCS_AI_ENABLED` | `false` | Master switch for the AI pipeline (classification, embedding, retrieval) |
| `GAUZY_DOCS_EMBEDDING_MODEL` | `text-embedding-3-small` | Embedding model id (1536 dims) |
| `GAUZY_DOCS_CLASSIFY_MODEL` | *(chat default)* | Classification model id |
| `GAUZY_DOCS_VERSION_DEBOUNCE_MINUTES` | `10` | Server-side debounce window for PAGE version snapshots |
| `GAUZY_DOCS_QUEUE_CONCURRENCY` | `2` | `docs-processing` worker concurrency per process |

## Building

Run `yarn nx build plugin-docs` to build the library.

## Running unit tests

Run `yarn nx test plugin-docs` to execute the unit tests via [Jest](https://jestjs.io).
