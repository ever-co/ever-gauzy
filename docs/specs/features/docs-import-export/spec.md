# Feature Specification: Docs import from exported workspaces and PDF export

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `docs-import-export`
**Branch**: `feat/docs-import-export`
**Status**: `In Review`
**Created**: 2026-11-11
**Last updated**: 2026-11-11
**Owner**: platform maintainers
**Feature flags**: `GAUZY_DOCS_IMPORT_ENABLED` (import, default off) and `GAUZY_DOCS_PDF_EXPORT_ENABLED`
(PDF export, default off); both require `FEATURE_DOCUMENTS`

---

## 1. Overview

Teams that move to the platform's Docs bring years of pages written elsewhere. Today they
can only upload files one by one, and the pages they upload stay files: not editable, not
linked to each other. This feature lets a member **import a whole exported workspace** in
one step and **export pages as PDF** for people outside the platform:

- **Import** takes one zip file in either of the two shapes knowledge tools export:
  - a **Markdown vault**: folders of `.md` pages with their attachments next to them, pages
    linking each other with `[[wiki links]]` and showing files with `![[embeds]]`;
  - an **HTML export zip**: nested folders whose page files carry an id in their name
    (`Roadmap 3f2a….md` or `….html`), a folder of the same name holding the sub-pages.

  The import recreates the page tree under a chosen page, folder or space: folders stay
  folders, pages become editable pages, links between pages keep working (they point at the
  new pages), images and attachments become files of the page that shows them. Titles,
  emoji icons and created dates come along where the export has them. The import runs in
  the background with live progress and ends with a report: what was imported (with links
  to the new pages), what was skipped and what failed, each with a reason.
- **PDF export** downloads a page, or a page with its sub-pages, as a PDF: a header with the
  title and the date on every sheet, images included, and for a subtree one PDF with a table
  of contents (or, on request, a zip with one PDF per page).

Both are available in the Angular Docs and in Ever Teams Docs through the same API, and
both stay invisible where an installation has not switched them on.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** a member with the right to create pages, **when** they open Docs, choose
  "Import", pick a Markdown vault zip, choose the "Engineering" team space and start,
  **then** they see the import progress (items done out of the total) and, when it ends, a
  report listing the imported pages with links, and the vault's folders and pages appear in
  the Engineering space in the vault's order.
- **Given** a vault page with `[[Release checklist]]` and `[[Onboarding|start here]]`,
  **when** it is imported, **then** both links open the imported "Release checklist" and
  "Onboarding" pages, the second one reading "start here".
- **Given** a vault page with `![[diagram.png]]` and `![[spec.pdf]]`, **when** it is imported,
  **then** the page shows the image inline and an attachment card for the PDF, and both are
  files of that page.
- **Given** an HTML export zip with a page "Roadmap 3f2a…" and a folder "Roadmap 3f2a…"
  holding two sub-pages, **when** it is imported under the page "Product", **then**
  "Roadmap" (without the id) is a sub-page of "Product" and the two sub-pages are under
  "Roadmap"; its emoji icon and its created date are the ones of the export.
- **Given** an HTML page of the export with headings, lists, a table, bold and links,
  **when** it is imported, **then** the new page shows the same structure as editable blocks.
- **Given** a member reading a page, **when** they choose "Export as PDF", **then** a PDF
  of the page downloads with the title and the date in the header and the page's images.
- **Given** a page with sub-pages, **when** the member chooses "Export as PDF with
  sub-pages", **then** one PDF downloads that starts with a table of contents and holds
  every sub-page they may read, each starting on a new sheet.

### 2.2 Edge cases & failures

- **Given** a zip larger than the import limit, **when** it is uploaded, **then** the upload
  is refused with the limit named and nothing is created.
- **Given** a zip that holds more entries than allowed, inflates past the size limit
  (a "zip bomb"), names a path outside the archive (`../`, an absolute path, a drive
  letter) or holds a symbolic link, **when** it is uploaded, **then** it is refused with
  the reason and nothing is created.
- **Given** a zip that is neither a Markdown vault nor an HTML export (no page file at all),
  **when** it is uploaded, **then** it is refused as "not an exported workspace".
- **Given** an attachment of a type the platform does not accept (an executable, an SVG),
  **when** the import reaches it, **then** it is skipped with the reason and the rest of
  the import goes on.
- **Given** a page that links to a page the zip does not hold, **when** it is imported,
  **then** the link text stays and the report counts the unresolved link on that page.
- **Given** HTML with scripts, styles, event handlers or `javascript:` links, **when** it is
  imported, **then** none of it reaches the page.
- **Given** the import worker stops in the middle (a restart, a crash), **when** the import
  is resumed (automatically, or as soon as someone looks at its progress), **then** it
  continues without creating any page twice and the report is complete.
- **Given** an organization whose storage quota the attachments would exceed, **when** the
  import reaches the attachment that does not fit, **then** that attachment and the ones
  after it are skipped with "storage quota reached"; pages are still imported.
- **Given** a member without the right to create pages, or a parent they may not write,
  **when** they start an import, **then** it is refused and nothing is created.
- **Given** a member who did not start an import, **when** they ask for its progress,
  **then** they receive "not found" (unless they manage Docs).
- **Given** a member who may not read some sub-pages, **when** they export a subtree as
  PDF, **then** those sub-pages (and what is under them) are left out.
- **Given** an installation with the import flag or the PDF flag off, **when** a client asks
  for the feature, **then** the routes answer "not found" and the clients hide the actions.

## 3. Functional Requirements

### Import

- **FR-1** Members with the right to create Docs pages MUST be able to upload one zip file
  (one per request) together with a target: a parent page or folder they may write, or a
  space (organization, a team they belong to, or private); without a parent the pages land
  at the top of the space.
- **FR-2** The platform MUST refuse, before anything is created: a zip over the size limit;
  more entries than the entry limit; declared or actual uncompressed size over the limit,
  including an entry that inflates past the size it declares; any entry path that is
  absolute, has a drive letter, a NUL byte or a `..` segment; any symbolic link; and an
  archive that holds no page file. The refusal MUST name the reason.
- **FR-3** The platform MUST detect the layout: an HTML export zip (page files and folders
  named with a trailing 32-hex id, or `.html` page files) or a Markdown vault (`.md` page
  files, `[[wiki links]]`), and report the detected layout.
- **FR-4** The import MUST run in the background (the platform's Docs job queue, or in
  process where there is none) and MUST be resumable: re-running an interrupted import
  creates no page, folder or file twice and completes the report.
- **FR-5** The import MUST expose its state: queued, running, completed or failed; the phase;
  the items done out of the total; and, when done, the report: every imported item with
  its new document, every skipped or failed item with a reason, the unresolved links per
  page. A failed import MUST state why.
- **FR-6** Folders MUST become folders; page files MUST become pages; a page file and a
  folder of the same name (or a folder's `index.md`) MUST become one page holding the
  folder's content as sub-pages; the order MUST follow the names.
- **FR-7** Markdown pages MUST be converted with the platform's Markdown-to-page converter;
  HTML pages MUST be sanitized and converted to Markdown first; the stored page MUST pass
  the page schema like any save.
- **FR-8** Links between imported pages (wiki links with or without alias and heading,
  relative Markdown or HTML links) MUST point at the new pages; embeds and images of
  attachments MUST show the new files; links outside the archive (http, https, mailto,
  tel) MUST stay; any other link MUST lose its target and keep its text.
- **FR-9** Attachments MUST pass the upload checks (type sniffing, size, the organization
  quota) and become files of the page that first shows them (or of their folder when no page
  shows them); they enter the same processing as uploads.
- **FR-10** Titles MUST come from the export (front matter `title`, the HTML title, else the
  file name without its id); the emoji icon and the created date MUST be kept where the
  export carries them (front matter `icon`/`emoji` and `created`, the HTML header and
  properties); a leading heading equal to the title MUST NOT be duplicated.
- **FR-11** Hidden files and folders (names starting with a dot, `__MACOSX`) MUST be ignored.
- **FR-12** Only the member who started an import, or a Docs manager, MAY read its state.

### PDF export

- **FR-13** Members who may read a page MUST be able to download it as a PDF; the PDF MUST
  carry the page title and the export date in a header on every sheet and page numbers.
- **FR-14** The PDF MUST render the page's headings, paragraphs and marks, lists and task
  lists, quotes, code, tables, rules, callouts, toggles, mentions and math as text, and
  the images stored in Docs; external images MUST NOT be fetched (their alternative text
  is shown).
- **FR-15** A subtree export MUST produce one PDF with a table of contents and every
  readable sub-page (each from a new sheet), or a zip with one PDF per page when asked;
  unreadable sub-pages MUST be left out with what is under them.
- **FR-16** Access MUST be checked as for the Markdown export: an unreadable page is "not
  found", a folder or a file is refused as "not a page".

### Clients and flags

- **FR-17** The Angular Docs and Ever Teams Docs MUST offer an Import dialog (pick the zip,
  the parent or space, start, live progress, the report with links to the imported pages
  and the skipped list) and an "Export as PDF" entry (page, page with sub-pages) in the
  page menu, each hidden when its route answers "not found".
- **FR-18** With `GAUZY_DOCS_IMPORT_ENABLED` off, every import route MUST answer 404
  `DOCS_IMPORT_DISABLED`; with `GAUZY_DOCS_PDF_EXPORT_ENABLED` off, every PDF route MUST
  answer 404 `DOCS_PDF_EXPORT_DISABLED`. Ever Teams additionally hides the import behind
  `NEXT_PUBLIC_DOCS_IMPORT_ENABLED` (default off).

## 4. Non-Functional Requirements

- **Performance**: an import of 1,000 pages and 500 attachments completes in minutes on one
  worker; the upload request answers as soon as the zip is checked and stored; a single-page
  PDF answers in under two seconds warm.
- **Reliability**: progress is saved as the import goes; a stalled import (no progress for
  ten minutes) is resumed; the import never creates a duplicate on resume.
- **Security & privacy**: archive limits and path checks before extraction, a second check
  while inflating, sanitized HTML, the page schema on every page, the upload checks on every
  file, tenant and organization snapshots on the job, nothing fetched from the network by
  the PDF renderer, the export's access checks; the uploaded zip is deleted when the import
  ends.
- **Observability**: import counts (imported, skipped, failed) on the job row and in the
  log line that ends the run.
- **Compatibility**: PostgreSQL, MySQL and SQLite; TypeORM and MikroORM; additive migration.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| `DocumentImport` | One import run: the uploaded zip, the target, the layout, the state, the progress and the report |
| Import item      | One entry of the zip as the import sees it: a folder, a page or an attachment, and what became of it |
| `Document` (existing) | The folders, pages and files the import creates, marked with the import as their source |
| PDF export       | A page or a subtree rendered as a PDF (or a zip of PDFs) |

## 6. Out of Scope

- Importing from a live third-party API (this feature reads exported zips only).
- Databases, comments, page history and permissions of the source workspace.
- Re-importing into existing pages (every import creates new pages).
- Fonts for scripts outside Latin, Greek and Cyrillic in the PDF (glyphs the bundled font
  lacks are left out) `[NEEDS CLARIFICATION: whether to bundle a wider font set]`.

## 7. Acceptance Criteria

- [ ] A Markdown vault and an HTML export zip import with folders, pages, links, images,
      attachments, titles, icons and created dates as specified.
- [ ] Oversize, bomb, traversal, symlink and non-workspace zips are refused with the reason.
- [ ] An interrupted import resumes without duplicates; the report is complete.
- [ ] A page and a subtree export as PDF with header, images and a table of contents.
- [ ] Both clients offer the dialogs and menu entries and hide them on 404.
- [ ] Works on PostgreSQL, MySQL and SQLite with both ORMs; behind the two flags.
- [ ] All functional requirements have a passing test.

## 8. Open Questions

- `[NEEDS CLARIFICATION: whether an import should also offer "update the pages of a previous import" (proposed: no; FR scope is create-only)]`

## 9. Constitution Gates

- [x] I Plugin-first — extends `packages/plugins/docs` and `docs-ui`.
- [x] II Tenant/organization scoping — the job carries the snapshot; every row is written with it.
- [x] III Both ORMs, additive migration — one new table.
- [x] IV Default-off flags; nothing removed.
- [x] V Contracts and API first.
- [x] VI Permissions, privacy, security — archive guards, sanitizing, the page schema, the upload checks, export access checks.
- [x] VII Real-time through the event bus — progress is polled; created pages emit the usual document events where a request context exists.
- [ ] VIII i18n and accessibility — dialog and menu strings in every locale (open until the clients land: the Angular
  dialog and menu in the docs-ui PR, Ever Teams after it).
- [x] IX Tests accompany the change.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Depends on: [`../docs-collaboration/spec.md`](../docs-collaboration/spec.md) (Markdown converter, subtree export, spaces)
- Consumers: Ever Teams `docs` spec
