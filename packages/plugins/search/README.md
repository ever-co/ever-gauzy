# @gauzy/plugin-search

Global search for the Ever Gauzy platform: one index over every domain, the providers that answer a
query, and the endpoints that read it.

## What this package owns, and what it does not

The two tables — `search_document` and `search_index_definition` — are **kernel** tables. They live in
`packages/core/src/lib/search/`, with their entities and their migration, because the index covers
contacts, invoices, expenses, products, orders, projects, tasks, employees and documents alike: an
index a single domain owned would make every other domain depend on that domain's package.

This package owns the **behaviour**:

| Concern | Where |
|---|---|
| Which entities are searchable, and how much each field counts | `src/lib/definitions/` |
| The declaration registry and its validation | `src/lib/registry/search-index.registry.ts` |
| The provider registry, the built-in database provider and the optional engine seam | `src/lib/providers/` |
| Turning an event or a source row into a document | `src/lib/services/search-indexer.service.ts`, `search-document.builder.ts` |
| Keeping the index current | `src/lib/search-index.consumer.ts` |
| Rebuilding it, in batches, without stopping the API | `src/lib/services/search-reindex.service.ts` |
| Answering a query, scoped to what the caller may see | `src/lib/services/search.service.ts` |
| The REST and GraphQL surfaces | `src/lib/search.controller.ts`, `src/lib/graphql/` |
| The seeded declarations | `src/lib/database/migrations/1791000000400-SeedSearchIndexDefinitions.ts` |

## Search works with nothing configured

The built-in database provider is registered unconditionally and is what answers when no engine is
configured, when the configured key names nothing registered, or when an engine reports unhealthy. A
deployment that installs this package and configures nothing else has a working, ranked, faceted
search on Postgres, MySQL and SQLite.

An external engine is a **binding, not a dependency**: a package provides its implementation against
the `SEARCH_PROVIDERS` token and this module never changes. The token is injected optionally, so an
installation with only the built-in provider boots — which is the whole point of the built-in one.

`FEATURE_SEARCH` is off by default, so the tables exist, empty, and none of the endpoints resolve
until a tenant enables it.

### How the four dialects and the two ORMs are served

Three things in the read path differ per dialect, and each is resolved from the live connection rather
than from an environment variable:

- **The promoted token list is a JSON array.** `search_document.keywords` is `jsonb` on Postgres,
  `json` on MySQL and a `simple-json` text column on SQLite, and the builder writes
  `["colour:red","channelid:abc"]` into all of them. A reader renders the column as text before it
  lowercases it — Postgres has no `lower(jsonb)` — and matches one entry by its quotes, which is what
  makes a token match insensitive to the whitespace each dialect renders an array with.
- **An attribute expression is built for the field's declared kind.** A number is compared as a
  decimal, a boolean is normalised to 1 or 0 because the three dialects extract a JSON `true`
  differently, and text, keywords, entity ids and dates are compared as text — a date is stored as the
  ISO-8601 string its column carried, and ISO-8601 text compares chronologically.
- **A caller's `%` and `_` are characters, not wildcards.** Every pattern built from request text is
  escaped and carries `ESCAPE '!'`, which is the one escape character all four dialects read the same
  way inside a string literal.

The **write** path reads its source rows through `SearchSourceConnection`, which resolves the metadata
and the rows over whichever ORM `DB_ORM` selects. That indirection is not decoration:
`@MultiORMColumn` emits only the active ORM's decorator, so under `DB_ORM=mikro-orm` TypeORM's
metadata for a searchable entity carries four columns and nothing else.

## The index is disposable

A document is a projection and never authoritative. It carries an entity type, an id, display text and
the declared attributes read from the source row — never a price, a stock level, a balance, a status
or a permission that anything computes with. Every reader re-reads the entity that owns the hit, a hit
whose row is gone is dropped from the page, and the whole table can be dropped and rebuilt to the same
content. That is what makes a reindex a maintenance operation rather than a data-loss risk.

## Endpoints

REST (one surface, no admin/public split):

| Method | Path | Permission |
|---|---|---|
| `GET` | `/api/search` | `SEARCH_VIEW` |
| `GET` | `/api/search/suggest` | `SEARCH_VIEW` |
| `GET` | `/api/search/facets` (also `/api/facets`, kept for clients that already call it) | `SEARCH_VIEW` |
| `GET` | `/api/search/index-status` | `SEARCH_VIEW` |
| `GET` | `/api/search/index-definitions` | `SEARCH_INDEX_DEFINITIONS_VIEW` |
| `GET` | `/api/search/index-definitions/:id` | `SEARCH_INDEX_DEFINITIONS_VIEW` |
| `PUT` | `/api/search/index-definitions/:id` | `SEARCH_INDEX_DEFINITIONS_EDIT` |
| `DELETE` | `/api/search/index-definitions/:id` | `SEARCH_INDEX_DEFINITIONS_EDIT` |
| `POST` | `/api/search/reindex` | `SEARCH_REINDEX` |
| `DELETE` | `/api/search/index` | `SEARCH_REINDEX` |

GraphQL: `search`, `searchSuggest`, `searchFacets`, `searchIndexDefinitions`,
`searchIndexDefinition`, `searchIndexStatus`, `updateSearchIndexDefinition`,
`deleteSearchIndexDefinition`, `reindexEntity`, `reindexAll`, `dropSearchIndex`.

An index declaration is **shipped, not authored**: the package that owns an entity states which of its
fields the index holds, because a field that does not exist on the entity produces an index that
silently never matches. An operator owns the weights, the templates, the promoted fields and whether
the entity is indexed at all.
