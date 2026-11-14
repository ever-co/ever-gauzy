# Task Breakdown: Docs import from exported workspaces and PDF export

**Feature ID**: `docs-import-export`
**Plan**: `./plan.md`
**Status**: `In Progress` — phases 1 and 2 in ever-gauzy #11803
**Last updated**: 2026-11-13

---

## Phase 1 — Spec, contracts, import server (ever-gauzy PR 1)

- [x] **T1**. Spec, plan, tasks; `docs/specs/README.md` row
- [x] **T2**. Contracts: import enums and interfaces, PDF export options
- [x] **T3**. Flags and limits in `docs.config.ts` / `docs.constants.ts`; `.env.sample`
- [x] **T4**. Entity `DocumentImport`, TypeORM + MikroORM repositories, migration `1791000007420` (PostgreSQL, MySQL, SQLite)
- [x] **T5**. `import-archive.ts`: limits, ratio, traversal, symlinks, counted inflation (+spec)
- [x] **T6**. `import-plan.ts`: layout detection, tree, folder pages, titles / icons / dates, hidden files (+spec)
- [x] **T7**. `import-content.ts`: wiki links and embeds, relative links, HTML sanitizing → Markdown → JSON, link rewriting, schema fallback (+spec)
- [x] **T8**. `DocumentImportRunner`: tree and content phases, attachments through the upload checks, resume by provenance, progress, report (+spec)
- [x] **T9**. `docs.import` stage on the queue (worker handler, inline dispatch, dead-letter), stale resume on read and at startup (+spec)
- [x] **T10**. `DocumentImportController` + DTO: `GET /imports`, `POST /imports`, `GET /imports/:id`; permissions, scoping

## Phase 2 — PDF export server (ever-gauzy PR 1)

- [x] **T11**. `pdf/tiptap-pdf.ts`: TipTap JSON → pdfmake content for every node type (+spec)
- [x] **T12**. `DocumentPdfService`: page, subtree with a table of contents, zip of PDFs; images from storage; header and footer (+spec on a real buffer)
- [x] **T13**. `DocumentPdfController`: `GET /exports/pdf` probe, `GET /documents/:id/export.pdf`
- [x] **T14**. Plugin README section (done); bot threads answered ([#11803](https://github.com/ever-co/ever-gauzy/pull/11803))

## Phase 3 — Angular docs-ui (ever-gauzy PR 2)

- [x] **T15**. `DocsImportService` (probe, upload with progress, poll, and the PDF download `downloadPdf`) (+spec; `DocsExportService` keeps the browser print) ([#11810](https://github.com/ever-co/ever-gauzy/pull/11810))
- [x] **T16**. Import dialog: zip, target page or space, start, progress, report with links, skipped and failed lists (+spec) ([#11810](https://github.com/ever-co/ever-gauzy/pull/11810))
- [x] **T17**. "Import" in the browse header, "Export as PDF" (page / with sub-pages) in the page menu; hidden on 404; i18n ([#11810](https://github.com/ever-co/ever-gauzy/pull/11810))

## Phase 4 — Ever Teams Docs (ever-teams PR)

- [x] **T18**. Proxy routes, `docs-import` service, hooks, `NEXT_PUBLIC_DOCS_IMPORT_ENABLED` ([ever-teams#5074](https://github.com/ever-co/ever-teams/pull/5074))
- [x] **T19**. Import dialog in Docs home; PDF entries in the page menu; hidden on 404 (+tests) ([ever-teams#5074](https://github.com/ever-co/ever-teams/pull/5074))
- [ ] **T20**. Strings in the 13 locales; Teams `docs` spec updated (strings done in [ever-teams#5074](https://github.com/ever-co/ever-teams/pull/5074); open: `docs/specs/features/docs/spec.md` in ever-teams still says PDF goes through the browser)

## Phase 5 — Verification

- [ ] **T21**. Flags on dev: a vault and an HTML export zip imported, a subtree exported as PDF, on PostgreSQL; SQLite demo boot
