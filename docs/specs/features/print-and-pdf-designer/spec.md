# Feature Specification: Print and PDF designer

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `print-and-pdf-designer`
**Branch**: `feat/print-and-pdf-designer`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: evereq
**Feature flag**: `FEATURE_PRINT_TEMPLATES` (tenant feature, default off) · the plugin loads only when
`GAUZY_PRINT_TEMPLATES_ENABLED` is exactly `true` · printers and print agents also behind `FEATURE_PRINT_AGENTS`
(default off). With the flags off every PDF the platform produces today is produced exactly as today.

---

## 1. Overview

Today invoices, estimates and payment receipts render to PDF from a layout fixed in code, in the invoice's language, with a "paid" watermark; each organization can keep invoice, estimate and receipt templates per language (marked-up text with merge fields) and preview them with sample data; Docs pages export to PDF behind their own flag. Nothing else prints: no order, delivery, statement, payslip, label or report has a layout, and there is no letterhead, bulk printing or printer.

This feature gives **every printable record type a print template**: each document type registered with the business document engine and each registered record type that declares print support, custom record types included. With no setup a type prints a clean standard layout of its fields, line tables and totals. A **visual designer** builds templates in two modes that can be mixed: a flowing layout of sections, columns and blocks (fields, linked fields, line tables, merge text, images, barcodes and QR codes, signatures, totals, terms) and a free-form canvas in millimetres for pre-printed forms, cheques and labels. Templates carry **page settings, fonts, header and footer bands, conditional display and texts per language**, are versioned with draft and publish, and are chosen per organization, party or context. Organizations keep **letterheads**; each feature ships **default templates**; today's invoice layouts and accounting templates become entries of the catalogue. One server-side engine renders PDFs identically in the cloud, on a self-hosted server, in the desktop server and on the SQLite demo, without a browser or network access. A **print queue** prints thousands of records in the background, **labels** fill sheets and rolls, and, as an optional connector, **print agents** in the Gauzy desktop app and network printers print directly. Clients: the Angular app, the MCP server, the API and SDKs.

**Advanced capabilities.** One template language serves **print, email and portal**: the same template renders a document's PDF, email body and public page. The designer previews **live with real records**, as a chosen role sees them. An **AI agent drafts a template** from a description or a sample PDF, always as an unpublished draft. PDFs can be **accessibility tagged** and **archival**, with embedded structured-invoice data. **Signature blocks** print captured signatures with a certificate page; a **verification code** lets anyone confirm a copy matches the original; invoices can carry a **tracked-time appendix** that reconciles to billed quantities; queue progress and printer status are **live**. These requirements are marked `(advanced)`.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** the feature on and nothing designed, **when** an employee prints a confirmed purchase order, **then** the dialog offers the default template, letterhead, the supplier's language and the outputs, and the PDF shows lines, totals, taxes by rate and terms.
- **Given** an administrator with `PRINT_TEMPLATES_MANAGE`, **when** they copy the shipped delivery note, place the address in the envelope window on the canvas, add a QR code of the number, hide prices and preview `DN-2026-0142`, **then** the preview shows that delivery and refreshes within a second of each change; **when** a user with
  `PRINT_TEMPLATES_PUBLISH` publishes it as default, **then** later prints use version 1.
- **Given** a customer whose language is French, **when** their invoice is printed, emailed or opened from the public link, **then** one template renders all three in French, with the organization's formats and the amount in words.
- **Given** 1,200 invoices selected in a saved view, **when** a user with `PRINT_JOBS_RUN` prints one merged PDF, **then** a background job shows live progress, each invoice starts on a new page in its customer's language, 3 drafts are skipped with the reason, and an inbox item links to the file.
- **Given** a receipt of 40 units of a lot-tracked item, **when** the clerk prints labels with the quantity from the received quantity from position 7 of a used sheet, **then** 40 labels with code, lot and barcode fill it from there.
- **Given** a register paired with a receipt printer through the desktop print agent, **when** a sale completes, **then** the receipt prints within two seconds on the 80 mm printer and the cash drawer opens.
- **Given** a scanned supplier delivery note, **when** a designer asks the assistant for "this layout for our deliveries", **then** a draft appears mapped to delivery fields with a list of what it could not map; nothing is published.
- **Given** a contract signed by two parties, **when** it is printed, **then** both signatures print with names and times and a certificate page lists the signatures and the document fingerprint.
- **Given** a printed invoice with a verification code, **when** an auditor scans it and uploads the PDF they hold, **then** a public page shows issuer, type, number, date and total and answers "matches" or "does not match".
- **Given** a report definition with a print template, **when** a manager prints it, **then** the PDF has the letterhead, prompts, grouped rows with subtotals, the chart and "page N of M".

### 2.2 Edge cases & failures

- **Given** a user without the record's view permission, **then** printing answers `403`; another organization's or tenant's record answers `404`.
- **Given** a field bound to a cost price the reader may not see, **then** the value is absent and a block bound only to it is not printed; a preview "as role" shows the same.
- **Given** two administrators on one template, **then** the second sees "being edited by …" read-only, and a save based on an older draft answers `409`.
- **Given** a job running on version 3 when version 4 is published, **then** the job finishes on version 3.
- **Given** a barcode value the symbology cannot encode, **then** the preview marks it and the render warns naming the record; it is never silently blank. **Given** a glyph the font lacks, **then** the fallback font draws it with a warning.
- **Given** a render longer than 30 seconds, **then** it stops, the user learns the record and block, and no partial PDF is returned.
- **Given** an organization that switched on "drafts need permission" (FR-95), a draft invoice and a user without `PRINT_DRAFTS`, **then** printing is refused; with it, the PDF carries a draft watermark no template can remove. With the setting off (the default), anyone who may print the type prints the draft, and the watermark follows the template's own conditions.
- **Given** an offline print agent, **then** dispatches wait up to 24 hours shown as "printer offline", are delivered in order on reconnect, and expire with a notice after that.
- **Given** a job interrupted after 600 of 1,200 records, **then** it resumes at 601 and no record appears twice.
- **Given** a template whose owning feature is off, **then** it is listed as unavailable; its outputs stay readable.
- **Given** the feature off, **then** every print route answers `404` and invoice PDFs come from today's layout.

## 3. Functional Requirements

### 3.1 Scope, flags and compatibility

- **FR-1** The system loads only when `GAUZY_PRINT_TEMPLATES_ENABLED` is exactly `true` and gates every route, GraphQL field, menu entry, page action, record tab and MCP tool with `FEATURE_PRINT_TEMPLATES`; off, they answer `404` and are hidden.
- **FR-2** The system keeps invoice, estimate and receipt PDFs (download, email attachment, public link) exactly as today until a template is assigned to that type for the organization; then the same routes render with it.
- **FR-3** The system keeps the accounting templates page, routes and each organization's selection unchanged, and lists each accounting template as a template of its type, previewable with real records and assignable, without changing it.
- **FR-4** The system keeps the Docs page PDF export and every other existing PDF unchanged.
- **FR-5** The system adds only optional print references to record contracts, renames or removes nothing, and keeps a tenant's templates and outputs inert when the feature is turned off.

### 3.2 Printable record types and the template catalogue

- **FR-6** The system offers templates for every document type registered with the business document engine and every registered record type that declares print support, custom record types included, with their counts.
- **FR-7** The system gives every printable type, with no setup, a standard template from its field catalogue: title, number, state, party and addresses, dates, field groups in layout order, line tables, totals, taxes and custom fields not hidden in print; it follows field changes without editing.
- **FR-8** A user with `PRINT_TEMPLATES_MANAGE` can create a template from the standard template, a blank page, a copy of any template (shipped ones included), a template file or an assistant draft.
- **FR-9** The system keeps per template a name per language, a key unique per type, its kind (layout, code, label, raw printer), its outputs (print, email, portal page), an organization allow-list, the roles that may use it, its status (draft, published, archived), its source and its versions.
- **FR-10** The system keeps shipped templates read-only; an upgrade never overwrites a tenant's copy, and the copy shows that a newer shipped version exists with its differences.
- **FR-11** A user with `PRINT_TEMPLATES_VIEW` can list templates by type, status, source, organization and last use, and see where each is used (assignments, report definitions, automations, registers, contexts).
- **FR-12** The system refuses to archive a template that is a default until it is replaced; archiving keeps versions and outputs.
- **FR-13** A user with `PRINT_TEMPLATES_MANAGE` can export a template with its fonts, images and snippets as one file and import such a file after a preview of what it adds or replaces.

### 3.3 Content

- **FR-14** The system offers blocks: merge text, field, linked-record field (three levels), line table, repeating group, image, barcode or QR code, signature, totals, taxes by rate, amount in words, terms, snippet, heading slot, divider, spacer, page break, section and columns.
- **FR-15** A field block shows its label (standard, hidden or custom per language), its value formatted by type, a prefix and suffix and a "hide when empty" switch; numbers can print as absolute values and negatives with a minus sign or in parentheses.
- **FR-16** A line table binds to any line collection or one-to-many relation and lets the user pick and order columns (custom fields included), set widths and alignment, repeat the header per page, number rows, alternate row styles, group by a field with subtotals, filter rows by a condition, keep a row on one page, add a summary row and set an empty-table text; one table per template flows across pages.
- **FR-17** A barcode block encodes fields or an expression in Code 128, Code 39, EAN-13, EAN-8, UPC-A, ITF-14, GS1-128, QR, Data Matrix or PDF417, with size, quiet zone, colours and optional readable text; a value it cannot encode is marked in preview and reported as a render warning.
- **FR-18** Every block, section and table row can carry a visibility condition from the condition builder (field, operator, value, all or any groups) or an expression; preview and render evaluate it alike.
- **FR-19** Text uses the platform's template language: field paths, conditions and loops, translation keys, and helpers for money in the document currency, numbers, dates and times in the print language, percentages, quantities with units, text case and defaults; it reaches nothing outside the print data, opens no file or network address and stops after a bounded number of steps.
- **FR-20** The print data holds the record and its lines, the party with addresses and people, the organization profile (names, addresses, registration and tax numbers, bank accounts, logo), the letterhead, totals and taxes by rate, linked document numbers, custom field values, the printing user, print time, copy number and heading.
- **FR-21** The system leaves out of preview and render every value the printing user may not read (custom field view permissions, permission-gated properties, and the field rules of `access-control-and-security` when loaded) and hides a block bound only to such a value.
- **FR-22** A user with `PRINT_TEMPLATES_MANAGE` can save a block or section as a snippet for one or all types and insert it linked (follows its published changes) or copied.
- **FR-23** A user with `PRINT_TERMS_MANAGE` can keep terms texts per language with merge expressions, for selling, buying or both, chosen document types and organizations, with attachments, "copy attachments" and a disabled switch; one text can be the default per document type and organization.
- **FR-24** The system offers terms texts to every document form: picking one copies the text rendered for that document into its terms (still editable) and, when set, its attachments; the terms block prints the document's terms. A new document starts with the terms text set as default for its type and organization or, for invoices and estimates without one, the organization's existing default invoice and estimate terms.
- **FR-25** A user with `PRINT_TEMPLATES_MANAGE` can keep print titles per language (copy, duplicate, credit note, pro forma, draft) picked at print time or set by rules: a reprint prints the copy heading, a draft the draft heading.
- **FR-26** The system prints a text or image watermark by condition; with the organization's setting of FR-95 on, it always prints the draft or cancelled watermark on a draft or cancelled document whatever the template says. Shipped templates mark drafts and cancelled documents by their own condition, except the shipped invoice, estimate and receipt templates, which reproduce today's layout.

### 3.4 Designer

- **FR-27** The flowing mode offers sections, rows and columns, a block palette, a searchable field palette (linked records and custom fields included), a properties panel and drag and drop.
- **FR-28** The canvas mode places elements at exact positions in millimetres, inches or points: draw, move, resize with handles, snap to grid, margins and elements with guides, select by frame, align and distribute, order front to back, nest in containers, nudge with arrow keys (one unit, ten with Shift) and type position and size.
- **FR-29** A flowing template can hold canvas areas (an address for a windowed envelope) and a canvas template can hold one flowing line table.
- **FR-30** The designer edits header, body and footer bands with distinct bands for first, odd, even and last pages, automatic or fixed heights, and warns when a band overlaps the body.
- **FR-31** The designer styles each element (font, size, weight, italic, underline, colour, background, borders per side, radius, padding, alignment, line height), a label apart from its value and table header and alternate rows apart from the body, with named styles reusable in the template.
- **FR-32** The designer offers undo and redo of 100 changes, copy and paste across templates, duplicate, a layers tree with hide and lock, keyboard shortcuts, and an outline editor that does with the keyboard all the mouse does.
- **FR-33** The system autosaves the draft within 10 seconds of a change; a user with `PRINT_TEMPLATES_PUBLISH` publishes it as a version with a note; history lists versions with author, compares two with changed blocks marked, and restores one as the draft.
- **FR-34** The system lets one person edit a draft at a time, shows who to others, allows a takeover after 2 minutes without activity, and answers `409` to a save based on an older draft.
- **FR-35** A user with `PRINT_TEMPLATES_CODE` can write a code template in the template language with markup and styles of a documented subset beside its preview; saving refuses unsupported elements by name so it renders the same everywhere; a layout template converts to code, not back.
- **FR-36** A template can declare input variables (name, type, default, label per language) the print dialog asks for, such as an attention line; no tenant code runs anywhere.
- **FR-37** The preview lists warnings before publishing: unknown fields, text overflowing fixed boxes, invalid barcode values, glyphs missing in a font, untranslated texts and images without alternative text.

### 3.5 Page settings, fonts and letterheads

- **FR-38** A template sets its page: A3 to A6, B5, letter, legal, executive, DL and C5 envelopes, 58 and 80 mm rolls of continuous length, or custom; orientation; unit; margins per side, mirrored for two-sided printing; band heights; scale.
- **FR-39** Bands can print page N of M, print date and time, the printing user and the copy number.
- **FR-40** The system bundles fonts for Latin, Greek, Cyrillic, Hebrew and Arabic scripts (regular, bold, italic); a user with `PRINT_TEMPLATES_MANAGE` can upload TrueType or OpenType fonts up to 10 MB after confirming the licence; PDFs embed the subsets used and no font is fetched from the network.
- **FR-41** Each element names a font with a fallback chain; a glyph the first font lacks is drawn by the next.
- **FR-42** A user with `PRINT_LETTERHEADS_MANAGE` can keep letterheads per organization, designed with the designer (text, images, organization fields) or as one image per band, with defaults per organization and document type, first page only or every page, a distinct first-page header and a disabled switch.
- **FR-43** The system takes the letterhead from the dialog (among those allowed), else the assignment, else the template's default, else the organization's, and prints none when the template says so.

### 3.6 Language and formats

- **FR-44** The system prints in the dialog's language, else the party's, else the template's default, else the organization's; template texts are kept per language and an untranslated text falls back with a preview warning.
- **FR-45** The system formats numbers, money and dates by the organization's settings and the print language, in the document's currency with the organization's symbol position.
- **FR-46** The system mirrors flowing layouts for right-to-left languages, keeps canvas positions as designed and lays out mixed-direction text correctly.
- **FR-47** The system prints amounts in words in every shipped language with currency and minor unit names, from the document's totals when the document engine provides them.

### 3.7 Choosing what prints

- **FR-48** The system resolves the template from the most specific assignment: party, then the owner's context (register, warehouse, sales channel, report definition), organization, tenant, standard template; per output.
- **FR-49** The print dialog offers the type's templates allowed to the user's roles and the record's organization, letterheads, languages, headings, input variables, copies and outputs (preview, download, browser print, email, printer, copy web link), and remembers the user's last choice per type.
- **FR-50** Each owning feature names the permission that prints its type (default: its view permission) and whether drafts and cancelled documents may print; with the organization's setting of FR-95 on, printing those also needs `PRINT_DRAFTS`.
- **FR-51** The system hands "send by email" to `email-and-communications` with the PDF attached; without it only the types that email today (invoices, estimates) offer email.

### 3.8 Rendering and outputs

- **FR-52** The system renders PDFs on the server with one built-in engine in every deployment, identically, without a browser or network access; images come only from the tenant's file storage and the record.
- **FR-53** The system renders several records into one PDF in order, each from a new page with its own numbering, and for two-sided printing inserts blank pages so each record starts on a front side.
- **FR-54** The system can append a record's PDF attachments after its pages on request.
- **FR-55** The system records each PDF made for a record (download, email, archive, portal, job, printer) with template and version, language, heading, copy number, user or agent, time, pages and content fingerprint, shown on the record to users with `PRINT_HISTORY_VIEW`; for invoices and estimates the entry is written once, by the server, into their existing history.
- **FR-56** The system stores an archival copy when a document of a type set to "archive on confirm" is confirmed; a reprint offers the archived original or a new rendering marked as a copy.
- **FR-57** The system produces PDFs in an archival profile on request, with embedded files (structured invoice data) when an owning feature supplies them. `(advanced)`
- **FR-58** The system produces accessibility-tagged PDFs: language, title, reading order from the template's structure, table headers, alternative text for images (required on publish unless decorative). `(advanced)`
- **FR-59** The system names the block and cause of a failed render and never returns a partial PDF.

### 3.9 Bulk printing and the print queue

- **FR-60** A user with `PRINT_JOBS_RUN` can print a selection, a saved view's records or ids from the API in one job: one template or each record's own, a letterhead, a fixed language or each party's, output one merged PDF, an archive of one PDF per record, or a printer.
- **FR-61** The system runs jobs above 10 records in the background with live progress and notifies the requester with an inbox item linking the file, kept 7 days by default (a period of the platform's retention settings).
- **FR-62** The system skips with the reason records the requester may not read or print, drafts without
  `PRINT_DRAFTS` where the organization's setting of FR-95 is on, and records of a type that is off.
- **FR-63** The system retries a failed record twice, carries on, lists failures, and lets the requester retry failed records only or cancel a running job.
- **FR-64** The system caps a job at the organization's limit (default 1,000, at most 5,000 records) and a user's concurrent jobs (default 3), refusing more with the limit named.
- **FR-65** The system resumes an interrupted job without printing a record twice, with the template versions current when it started.
- **FR-66** A user can list their jobs (with `PRINT_HISTORY_VIEW` everyone's), read each result log and download it as CSV.

### 3.10 Labels

- **FR-67** A label template lays out one label on a sheet (page size, rows, columns, label size, gaps, margins, common sheet layouts offered) or a roll (label size and gap).
- **FR-68** A user who may print the type can print labels for chosen records with a quantity per record (fixed, from a field such as received quantity, or typed), a start position on a used sheet and a sort order.
- **FR-69** The system prints an alignment test page with label outlines.

### 3.11 Reports

- **FR-70** The system prints a report definition through a report template: title, prompts and filters used, columns with group headers and subtotals, charts, letterhead, page numbers; a definition can name its template and letterhead.
- **FR-71** The system leaves the existing report pages' own export and PDF actions unchanged.

### 3.12 Printers and print agents

- **FR-72** With `FEATURE_PRINT_AGENTS`, a user with `PRINT_PRINTERS_MANAGE` can pair a print agent (the Gauzy desktop app next to the printers) with a single-use code valid 10 minutes and register its printers, or register a network printer the server reaches by the standard internet printing protocol.
- **FR-73** A printer has a name, location, organization, kinds (documents, receipts, labels), media, the command language of its raw templates and the purposes and contexts it is the default for.
- **FR-74** A raw template turns a record into commands for receipt and label printers, with helpers for text styles, alignment, barcodes, paper cut and cash drawer pulse, sent as bytes.
- **FR-75** A user with `PRINT_PRINTERS_USE` can send a PDF or raw output to a printer from the dialog or a job, and owning features (registers, packing stations) can print silently to their context's default printer.
- **FR-76** The system shows each dispatch live as queued, sent, printed or failed with the printer's message, with retry and reprint.
- **FR-77** The system keeps dispatches for an offline agent up to 24 hours (organization setting), delivers them in order on reconnect, then marks them failed and notifies the requester.
- **FR-78** The system shows printer status (online, offline, paper out, error) live and prints a test page on request.
- **FR-79** The system gives each agent a revocable credential, sends it only its printers' dispatches, needs no inbound connection to it, and refuses network printers at private addresses unless the deployment allows them.

### 3.13 Shipped templates and owning features

- **FR-80** The system lets each feature ship default templates for its types, seeded for a tenant on enable and upgraded with the feature unless the tenant copied them; seeding assigns nothing to a type that prints today (invoices, estimates, receipts), which keeps today's layout until an administrator assigns a template (FR-2).
- **FR-81** The system ships invoice, estimate and receipt templates reproducing today's layout, a generic document template for engine document types without one, a report template, an item label and an address label sheet.
- **FR-82** The system installs regional packs' print layouts as shipped templates of the pack and archives them when the pack is removed.
- **FR-83** The system gives owning features one service to render a record to PDF or HTML, resolve the template for a context and start a job; with the feature off their own fallbacks apply.
- **FR-84** The system exposes every capability through REST, with GraphQL reads of templates and outputs.

### 3.14 One template, live preview, agents and time `(advanced)`

- **FR-85** The system renders one flowing template to a record's PDF, email body and portal or public page, leaving out what only paper needs; canvas, label and raw templates are print only. The email template stays the message (subject, greeting, wrapper) and embeds the rendered body; the existing public invoice page shows it when such a template is assigned. `(advanced)`
- **FR-86** The designer previews with any record the designer may read, in any language and letterhead, as PDF, email or page, within a second of a change, and "as a role" with that role's masks. `(advanced)`
- **FR-87** A user with `PRINT_TEMPLATES_MANAGE` can ask the assistant to draft a template from a description or a sample PDF or image: an unpublished draft with bindings mapped to the type and a report of what was not mapped.
  `(advanced)`
- **FR-88** The system keeps a drafting sample at most 24 hours, for that request only, sent only to the AI provider the tenant configured. `(advanced)`
- **FR-89** The system offers MCP tools to list templates, preview a record, print records, draft, check and explain a template, under the caller's permissions; publishing stays with a person. `(advanced)`
- **FR-90** A signature block names a signer role and prints the signature the owning feature captured with name and time, or a signing line with an optional signing link code; a template can append a certificate page listing each signer, time, method and the document fingerprint. `(advanced)`
- **FR-91** A template can print a verification code opening a public page without sign-in that shows issuer, type, number, date and total and answers "matches" or "does not match" for an uploaded PDF; codes are revocable and the page rate limited. `(advanced)`
- **FR-92** An invoice template can include a tracked-time appendix of the time logs billed by each line (date, person, task, duration, note), grouped by project or person, reconciling to invoiced quantities; a mismatch warns in preview.
  `(advanced)`
- **FR-93** The system pushes job progress, dispatch states, printer status and draft presence to open clients through the platform's real-time channel. `(advanced)`

### 3.15 Reports of this feature

- **FR-94** The system produces these reports, filterable by organization and period, exportable as CSV:

  | Report | Content |
  |---|---|
  | Print usage | outputs per record type, template, purpose, user or agent, organization and period |
  | Queue | jobs with requester, counts, duration, skipped and failed records |
  | Template inventory | templates with status, source, versions, last publish, where used, open warnings |
  | Printers | dispatches per printer, failures, time offline |

### 3.16 Draft printing rule

- **FR-95** A user with `PRINT_TEMPLATES_MANAGE` can switch on, per organization, "drafts need permission" (default off): then printing a draft or cancelled document, by any route, dialog, job or agent, needs `PRINT_DRAFTS` and the draft or cancelled watermark prints whatever the template says. With it off, anyone who may print a type prints its drafts and cancelled documents as today's invoice, estimate and receipt routes do, and a job skips none for want of `PRINT_DRAFTS`.

## 4. Non-Functional Requirements

- **Performance**: a record of up to 200 lines renders in under 2 s at the 95th percentile; the designer preview of one page in under 1 s; a job prints at least 20 records per second per worker on four cores; a render stops after 30 s; a PDF holds at most 2,000 pages; images are scaled to 300 dpi at printed size.
- **Reliability**: jobs resume and never print a record twice; renders run apart from request handling; dispatches survive restarts.
- **Security & privacy**: records print only for readers, masks apply on every output, the template language cannot reach outside the print data, fonts, images and samples are type- and size-checked, agent credentials are hashed and revocable. Leaving the platform: PDFs emailed through the communications feature, dispatches to the tenant's own printers, drafting samples to the tenant's AI provider.
- **Observability**: every output, publish, job and dispatch recorded; render time, failures and queue lag measured.
- **Accessibility and localisation**: keyboard designer with outline editor, screen-reader labels, tagged PDFs; texts per language, shipped templates in every shipped language, right-to-left layouts.
- **Compatibility**: PostgreSQL, MySQL and SQLite with both ORMs; cloud and self-hosted alike; OpenAPI additive.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| Print template | The layout a record type prints, emails or shows with: blocks, page settings, texts per language, versions |
| Template version | A published, immutable state of a template |
| Assignment | Which template and letterhead apply to a type for an organization, party or context and output |
| Letterhead | An organization's header and footer for printed documents |
| Snippet | A reusable block or section |
| Terms text | Reusable terms with merge fields offered to document forms |
| Print title | A named heading on a copy (copy, duplicate, draft, pro forma) |
| Print font | A font the tenant uploaded |
| Print output | One PDF made for a record, with its purpose and fingerprint |
| Print job | A bulk print with its result log |
| Printer, print agent, dispatch | A printer reached through a desktop agent or the network; the agent; one output sent to one printer |

## 6. Out of Scope

- Email transport, email templates and delivery tracking: `email-and-communications`.
- Web-view links, record sharing and field rules: `access-control-and-security`; portal pages: `customer-and-supplier-portal`.
- Capturing signatures: the owning specs (`sales-order-management`, `crm-leads-and-deals`, `hr-core-lifecycle`).
- Report definitions and datasets: `report-builder-and-dashboards`; structured invoice formats: `regional-compliance-packs`.
- Cheque books and register: `payments-and-collections`; registers and sales: `point-of-sale-and-loyalty`.
- Agent definitions, tool permissions and AI cost limits: `ai-agents-and-assistants`; Docs export: `documents-and-wiki`.

## 7. Acceptance Criteria

- [ ] **AC-1** With nothing designed, a purchase order, a delivery, a custom record and an item print a standard layout; an invoice prints today's layout until a template is assigned (FR-7, FR-80, FR-81).
- [ ] **AC-2** An accounting template previews with a real invoice and, once assigned, drives download, email and link (FR-2, FR-3).
- [ ] **AC-3** A designed template (canvas address window, grouped table with subtotals, QR code, condition, French texts) prints correctly for a chosen record; publishing creates version 1 (FR-16, FR-18, FR-29).
- [ ] **AC-4** Letterheads, headings, terms texts and watermarks print as set; a draft printed from a shipped template other than today's invoice, estimate and receipt layouts carries the draft mark, and with the FR-95 setting on every draft carries it.
- [ ] **AC-5** A masked field is absent in preview, PDF, email and page for a reader without its permission (FR-21).
- [ ] **AC-6** A 1,200-record job resumes after a restart, skips with reasons, and finishes on its starting versions (FR-62, FR-65).
- [ ] **AC-7** Labels print from position 7 with quantities from the received quantity; the test page aligns (FR-67–FR-69).
- [ ] **AC-8** A report definition prints with letterhead, prompts, subtotals and "page N of M" (FR-70).
- [ ] **AC-9** A paired agent prints a receipt with a drawer pulse; offline dispatches wait and expire; a revoked agent receives nothing (FR-74, FR-76–FR-78).
- [ ] **AC-10** One invoice template renders PDF, email body and public page in the party's language (advanced: one template language; FR-44, FR-85).
- [ ] **AC-11** Preview refreshes within 1 s and "as role" hides that role's masked fields (advanced: live preview; FR-86).
- [ ] **AC-12** The assistant drafts from a sample PDF an unpublished draft with a mapping report; the sample is gone after 24 hours (advanced: agent drafting; FR-87, FR-88).
- [ ] **AC-13** Archival and tagged PDFs pass an open-source validator in CI (advanced: archival and accessible PDFs; FR-57, FR-58).
- [ ] **AC-14** A signed contract prints both signatures and a certificate page; verification answers "matches" for the original and "does not match" for an edited copy (advanced: signatures and verification; FR-90, FR-91).
- [ ] **AC-15** A tracked-time appendix reconciles to invoiced quantities and warns on a mismatch (advanced: time; FR-92).
- [ ] **AC-16** The four reports of FR-94 show the expected rows for a seeded tenant.
- [ ] **AC-17** Works on PostgreSQL, MySQL and SQLite with both ORMs; behind `FEATURE_PRINT_TEMPLATES`; nothing changes while the flag is off; every functional requirement has a passing test (FR-1, FR-5; §4).
- [ ] **AC-18** With "drafts need permission" off (the default) a user holding only the invoice view permission downloads a draft invoice as today, with and without an assigned template; with it on, the same request is refused and a permitted user's PDF carries the draft mark. Enabling the feature assigns no template to invoices, estimates or receipts, and the invoice pages show no print action or outputs tab while the flag is off (FR-50, FR-95).
- [ ] **AC-19** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-1).

## 8. Open Questions

- Fonts for Chinese, Japanese and Korean add about 20 MB: proposed default, not bundled; tenants upload them or install an optional font pack plugin.
- "Archive on confirm": proposed default off, switched on by regional packs whose country requires an original copy.
- Code templates: proposed default, `PRINT_TEMPLATES_CODE` granted to super admins only.
- Network printers at private addresses: proposed default, refused unless `GAUZY_PRINT_PRIVATE_NETWORK_ALLOWED=true` (self-hosted); cloud tenants use print agents.
- Verification page contents: proposed default, issuer, type, number, date and total only.

## 9. Constitution Gates

- [x] I Plugin-first — new plugin pair `print-templates`; core gains one optional invoice renderer port and one shared PDF service used by invoices, Docs and print.
- [x] II Tenant/organization scoping — every table scoped; renders read only the requester's records.
- [x] III Both ORMs, additive migrations — five plugin migrations on three dialects; no core table changes.
- [x] IV Default-off flag; nothing removed — deploy switch plus `FEATURE_PRINT_TEMPLATES`; today's PDFs unchanged.
- [x] V Contracts and API first — contracts, REST, GraphQL reads and the render service before the designer.
- [x] VI Permissions, privacy, security — eleven permissions, masks on every output, sandboxed template language.
- [x] VII Real-time through the event bus — outbox events and real-time hints for jobs, dispatches and presence.
- [x] VIII i18n and accessibility — texts per language, right-to-left, keyboard designer, tagged PDFs.
- [x] IX Tests accompany the change — unit, renderer snapshot, dialect, ORM parity and e2e per task.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Builds on: [`business-document-engine`](../business-document-engine/spec.md), [`custom-fields-and-forms`](../custom-fields-and-forms/spec.md), [`record-views-and-search`](../record-views-and-search/spec.md), [`access-control-and-security`](../access-control-and-security/spec.md)
- Used by: [`invoicing-receivables-payables`](../invoicing-receivables-payables/spec.md), [`sales-order-management`](../sales-order-management/spec.md), [`procurement`](../procurement/spec.md), [`delivery-and-shipping`](../delivery-and-shipping/spec.md), [`payments-and-collections`](../payments-and-collections/spec.md), [`payroll-processing`](../payroll-processing/spec.md), [`hr-core-lifecycle`](../hr-core-lifecycle/spec.md), [`point-of-sale-and-loyalty`](../point-of-sale-and-loyalty/spec.md), [`report-builder-and-dashboards`](../report-builder-and-dashboards/spec.md), [`regional-compliance-packs`](../regional-compliance-packs/spec.md)
- Code: `packages/core/src/lib/accounting-template/`, `packages/core/src/lib/invoice/{pdfmaker.service.ts,generate-invoice-pdf.ts}`,
  `packages/plugins/docs/src/lib/pdf/`
