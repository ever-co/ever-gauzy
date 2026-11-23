# Feature Specification: Custom fields and forms

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `custom-fields-and-forms`
**Branch**: `feat/custom-fields-and-forms`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_CUSTOM_FIELDS` (tenant feature, default off) · custom record types also behind
`FEATURE_CUSTOM_RECORD_TYPES` (default off) · the plugin loads only when `GAUZY_CUSTOM_FIELDS_ENABLED` is exactly `true`

---

## 1. Overview
Today a field can be added to a record only in code: a plugin declares a relation on employees, projects or tags at
boot. This feature makes fields, forms and rules data an administrator manages without code, on **every record type**
(employees, contacts, leads and deals, projects, tasks, invoices, expenses, vendors, items, time off, and every type a
plugin registers, such as sales and purchase orders) and on **custom record types** created in the browser. **Custom
fields** come from one type catalogue with behaviour switches; **field rules** show, hide, require, lock, filter,
default, copy and validate fields; **form layouts** arrange fields for main form, quick entry, side panel, line editor
and transition forms; **form actions** put buttons on records. Values are validated alike on every write path and reach
lists, filters, views, reports, imports, exports, print, search, events, REST, GraphQL, SDKs and MCP. Clients: the
Angular app (installable on phones), the API and SDKs, the MCP server.

**Advanced capabilities.** One formula language computes fields and drives rules, shared with workflow conditions,
automation actions and pricing, and evaluated identically in browser and server. Fields **roll up** related records,
tracked time and its cost included. Every value change keeps **field-level history** with its source and can be
restored. Layouts differ **per role and per device**. Fields can apply to some organizations of a tenant only.
Customizations go **draft, publish, deprecate** with an impact analysis and travel as **packages** with a diff and an
undo. A custom record type has permissions, views, reports, API, events and MCP tools **from publication**. An assistant
drafts customizations from a sentence; agents fill records under the same rules as people. Marked `(advanced)`.
## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** an administrator with `CUSTOM_FIELDS_MANAGE`, **when** they add a required date field "Contract renewal" to
  contacts after "Phone" and publish it, **then** it shows in the contact form, as a list column and filter, in contact
  report definitions and import mappings, and under `customFieldValues` in `GET /api/organization-contacts/:id`.
- **Given** choices "Region" and "Sales office" with "offices depend on region", and "Discount reason is visible and
  required above a 10 % discount", **when** a user picks "North" and types 12 %, **then** only northern offices are
  offered and the save needs a reason, in the browser and through the API alike.
- **Given** a formula "Margin %" on sales orders and a roll-up "Hours tracked this month" on contacts, **when** an order
  is saved and a timer on a contact's project stops, **then** the margin is stored and filterable, and within a minute
  the contact shows the new hours and cost "as of" the computation time.
- **Given** a phone layout for "Field technician" and a desktop layout with a "Credit" section for managers, **when** each
  opens a contact, **then** each sees their layout and the technician never receives the credit values.
- **Given** `CUSTOM_RECORD_TYPES_MANAGE`, **when** an administrator publishes "Vehicle" with a series, fields, lines
  "Service visit" and permissions (fleet managers edit, employees view their own), **then** "Vehicles" has a menu entry,
  list, detail, views, reports, import, print, `/api/custom-records/vehicle`, events and MCP tools at once.
- **Given** a draft field the assistant drafted from "tax exemption expiry, finance only", **when** the administrator
  previews it as "Sales" on a phone and publishes, **then** it is live for everyone at once, masked to finance;
  deprecating the field it replaces first lists the reports, views and automations using it.
- **Given** a package exported from one organization, **when** it is imported into another tenant, **then** the importer
  sees new, changed and conflicting items, chooses per conflict, and can undo while nothing it created holds values.

### 2.2 Edge cases & failures

- **Given** a required field, **when** an API create omits it, **then** `400` names it and nothing is saved; a duplicate on
  a unique field (case and spaces ignored) is `409`, naming the holder only to someone who may view it.
- **Given** two administrators on one layout draft or two users on one record, **when** the second saves, **then** it is
  refused as stale and nothing of it is written.
- **Given** a published field with values, **when** its type is changed or it is deleted, **then** it is refused; a
  conversion with a preview ("1,028 convert, 12 do not") or deprecation is offered. Archived options stay on records.
- **Given** a formula dividing by zero, **then** the value is empty, the record is listed in the field's health view and
  the save succeeds; two formulas depending on each other are refused naming the cycle.
- **Given** a reference to a record the user cannot see, **then** it shows "restricted record", kept and unrevealed; a
  masked value is absent from reads, exports, print and MCP for users without its permission, and their writes get `403`.
- **Given** no `CUSTOM_FIELDS_MANAGE`, definition routes answer `403`; with `FEATURE_CUSTOM_FIELDS` off every route answers
  `404`, forms show no custom section, values stay untouched and code-declared fields keep working.
- **Given** the installed web app on a phone syncing an offline save after a rule changed, **then** the server re-validates, answers
  the fields to fix and the device keeps the draft; a bulk update of 200 records with 7 invalid saves 193 and lists 7.
- **Given** a plugin switched off, **then** its record types leave Customization and their definitions and values are
  kept; a custom record type with records cannot be deleted; a 301st field on a type is refused naming the limit.

## 3. Functional Requirements

### 3.1 Scope, flags and compatibility

- **FR-1** The system loads only when `GAUZY_CUSTOM_FIELDS_ENABLED` is exactly `true`, gates every route, GraphQL field,
  menu entry and MCP tool with `FEATURE_CUSTOM_FIELDS` (record types also `FEATURE_CUSTOM_RECORD_TYPES`); off: `404`.
- **FR-2** The system keeps the code-declared custom fields (relations plugins add at boot to employees, projects and
  tags) working unchanged and lists them read-only as system fields of their plugin.
- **FR-3** The system adds, changes, deprecates and archives fields without run-time schema change, deployment or restart.
- **FR-4** The system adds only `customFieldValues` to record contracts; nothing existing is renamed, repurposed or removed.

### 3.2 Record types

- **FR-5** The system keeps one registry of record types (key, labels, scoping, view and edit permissions, title, link),
  built on the type names, permissions, list and search fields the platform declares:
  employees, candidates, contacts (customers, leads, clients), deals, projects, tasks, teams, invoices and estimates,
  payments, expenses, incomes, vendors, items, equipment, time-off requests, goals, and each loaded plugin's own types.
- **FR-6** A user with `CUSTOM_FIELDS_MANAGE` can list record types with counts of fields, rules, layouts and actions; a
  type of a plugin that is not loaded is not listed, and its definitions and values are kept.
- **FR-7** A user with `CUSTOM_FIELDS_MANAGE` can set per record type, on one page linking all its customization: title,
  image and search fields, sort, quick entry, history, copy, attachments limit, default print and email templates.

### 3.3 Field definitions and types

- **FR-8** A user with `CUSTOM_FIELDS_MANAGE` can add a field to any registered record type with label and help per
  language, a key (editable until first publish, unique per type, never reused), type, placeholder, group and position.
- **FR-9** The system offers these field types:

  | Family | Types |
  |---|---|
  | Text | short text, long text, formatted text (sanitised), email address, phone number, web address |
  | Numbers | whole number, decimal (precision 0 to 9), percentage, money (amount and currency), duration, rating |
  | Time | date, date and time, time of day |
  | Choices | yes or no, single choice, multiple choice |
  | References | one record, several records, record of a type chosen in another field, person, team |
  | Content | file, files, image, drawn signature, colour, location (address or coordinates) |
  | Structure | lines (rows of a child record type edited inside the record) |
  | Computed | formula, roll-up, auto-number |

- **FR-10** The system configures per type: precision; money currency (fixed, organization's, per value); duration units;
  rating scale; text length; options (labels per language, colour, order, default, archived); reference targets and
  filter; multi-value count; file kinds and size; date bounds fixed or relative to today.
- **FR-11** The system offers in a reference picker only records the user may view in the allowed organizations, searched
  on the target type's search fields, and shows a stored reference the user cannot view as "restricted record".
- **FR-12** A user with `CUSTOM_FIELDS_MANAGE` can add a lines field: rows of a child record type edited as a grid inside
  the record, saved with it all or nothing, on standard and custom record types.
- **FR-13** The system refuses a 301st field per record type, a 2,001st option and a 501st multi-value, naming the limit.

### 3.4 Behaviour, validation and standard fields

- **FR-14** A user with `CUSTOM_FIELDS_MANAGE` can set per field: required, unique (organization or tenant), read-only,
  fixed after first save, left out of duplicates, bounds, default (value or formula), list, filter, sort, search,
  quick-entry, print, history and timeline flags, and the permissions to view and to edit it.
- **FR-15** The system enforces type, required, unique, bounds, options, references, fixed values, read-only and masks on
  every write path (form, REST, GraphQL, bulk, import, MCP, automation, workflow, agent) with the form's verdict: `400`
  naming field and reason, `409` for a duplicate.
- **FR-16** The system checks uniqueness among live records of the scope, ignoring case and surrounding spaces for text,
  and names the holding record only to a user who may view it.
- **FR-17** The system never gives a masked value to a user without its view permission (REST omits it, GraphQL answers
  null, exports, print, reports and MCP omit it) and refuses their writes to it with `403`.
- **FR-18** A user with `CUSTOM_FIELDS_MANAGE` can override a standard field's label, help, order, visibility, default,
  list and filter defaults, and make it required (never optional, editable or retyped; options only where declared);
  overrides apply to forms and server validation and reset per field or type.
- **FR-19** The system applies a field or override to all organizations of the tenant or to listed ones only; other
  organizations' forms, validation, API and reports ignore it. `(advanced)`

### 3.5 Field rules and the formula language

- **FR-20** A user with `CUSTOM_FIELDS_MANAGE` can add rules to any field: visible, required, read-only, choice options,
  reference filter (may use other fields), default, valid only (with a message), each "when" a condition holds; copy from
  a referenced record (on selection, when empty, or kept in sync); section collapsed or hidden when.
- **FR-21** The system builds conditions with the platform's condition builder (attribute, operator, value; all-of groups
  joined by any-of) or a yes-or-no formula, over the record's fields, referenced records up to two hops, the user (roles,
  organization, department, teams), the device and today; each rule is editable visually and as text.
- **FR-22** The system provides one formula language (arithmetic, logic, text, date and duration functions, conditional
  choice, two-hop lookups, aggregates over lines; exact decimals; no loops, side effects or outside access; bounded),
  shared with workflow conditions, automation actions and pricing formulas. `(advanced)`
- **FR-23** The system evaluates rules identically in the browser, as the user types and without a round trip, and on the
  server, whose verdict decides the save.
- **FR-24** The system refuses unknown fields, type mismatches and dependency cycles when a rule or formula is saved,
  naming the path.
- **FR-25** A user with `CUSTOM_FIELDS_MANAGE` can test a rule or formula on a record or sample values and see each
  condition's result and computed value, saving nothing.
- **FR-26** The system neither requires nor validates a field hidden by a rule and keeps its value; a field made
  read-only by a rule keeps its value and refuses changes.

### 3.6 Computed and roll-up fields

- **FR-27** The system stores a formula field's value (filterable, sortable, reportable), recomputes it on every save and
  within one minute of a change of a referenced input, and keeps it read-only everywhere.
- **FR-28** A user with `CUSTOM_FIELDS_MANAGE` can define a roll-up (count, sum, minimum, maximum, average, earliest,
  latest, distinct count) over related records with filters, refreshed within a minute of a related change and nightly,
  showing when it was computed. `(advanced)`
- **FR-29** The system lets a roll-up total tracked time (hours, and cost from the employees' rates) of an employee,
  project, task, contact or custom record over a period (this week, this month, last N days). `(advanced)`
- **FR-30** The system leaves a computed value empty when it cannot compute it, lists the record in the field's health
  view, and never refuses a save for it unless the formula is a validation rule.
- **FR-31** The system recomputes existing records in the background with progress when a formula or roll-up changes;
  earlier values stay readable until replaced.
- **FR-32** The system numbers an auto-number field from a numbering series per organization at the record's first save.

### 3.7 Form layouts

- **FR-33** A user with `FORM_LAYOUTS_MANAGE` can design a layout by drag and drop or a keyboard list editor: tabs,
  sections, one to four columns, fields, headings, help, related-records panel, and per-field overrides (label, width,
  required, read-only, hidden, sticky).
- **FR-34** The system supports layout kinds: main form (create, edit, detail), quick entry, side panel, line editor, and
  transition form (fields demanded by a workflow transition or a conversion such as lead to deal).
- **FR-35** The system picks the published layout of the kind with the highest priority whose audience (everyone or
  roles), device (any, desktop, tablet, phone) and condition match; else a default one. `(advanced)`
- **FR-36** The system lets a layout inherit another of its type and kind; parent changes reach the child.
- **FR-37** A user with `FORM_LAYOUTS_MANAGE` can preview a layout as a role, device and record before publishing.
- **FR-38** The system keeps draft and published layout versions, publishes atomically, restores earlier versions, and
  refuses to publish a layout hiding a field its definition requires or omitting a required standard field, naming it.
- **FR-39** The system never lets a layout widen access: masks hold; read-only from permissions or a workflow state wins.
- **FR-40** The system shows a related-records panel counting the records of other types linked to the record, each tile
  opening the filtered list or creating a linked record, and shows choice options' colours as badges.
- **FR-41** The system renders custom record types entirely from layouts in the Angular app, phones included. A standard
  type (first: contacts, deals, vendors, projects, employees, items) renders from layouts only after an administrator
  switches that type to layout rendering (a per-type setting, off by default, switchable back at any time); until then,
  and on every other page, its existing form stays as it is and shows a custom field section.
- **FR-42** The system renders forms in the user's existing language, time zone, date, time and number formats and theme.
- **FR-92** Questionnaires of other features (job applications, review templates, exit interviews, web forms) use
  one question-set format: questions in the field types of FR-9 with labels per language, required flag, options and
  visible-when conditions, in published versions that never change; answers are kept by question key and version and
  validated alike in browser and server through one editor and answer form, usable without custom fields switched on.

### 3.8 Quick entry, lines, templates and defaults

- **FR-43** The system offers "Create" in every picker of a type with quick entry on, opening the quick-entry layout and
  selecting the new record on save; missing required fields make the dialog offer the full form with values kept.
- **FR-44** The system shows lines as a grid with the line-editor layout's columns, opens a row form, and adds,
  duplicates, reorders and deletes rows, with roll-up totals.
- **FR-45** A user with the record's view permission can save its values as a named template (unique, fixed and
  duplicate-excluded fields left out), private or, with `RECORD_TEMPLATES_SHARE`, shared, and start records from it.
- **FR-46** The system lets each user set own defaults for fields marked as allowing it; header selections (organization,
  project, employee, team, dates) keep prefilling; precedence: rule, user default, session selection, field default.
- **FR-47** The system copies custom values on duplicate except unique, fixed and duplicate-excluded fields.
- **FR-48** A user with `CUSTOM_FIELDS_MANAGE` can set per type the message after a create and its next-step actions.

### 3.9 Form actions

- **FR-49** A user with `FORM_ACTIONS_MANAGE` can add actions to a record type: label, icon, placement (toolbar, menu,
  list bulk menu, beside a field), visible when, permission, confirmation and an optional input form.
- **FR-50** The system supports actions that open a web address built from values (https only, encoded), open an app
  page, set fields, create a related record through a mapping, start an automation flow, perform a workflow transition,
  call an outgoing webhook, or ask an agent with a prompt and the record.
- **FR-51** The system runs actions with the user's permissions, shows results or refusal reasons, offers them in the
  Angular app and MCP, and reports per record for bulk actions.
- **FR-52** The system runs no tenant-written program code in the browser, and none on the server of the cloud
  deployment; on a self-hosted installation scripts run only behind its deployment switch (FR-88 to FR-91); other
  behaviour beyond rules, formulas and actions comes from automation flows or plugins.

### 3.10 Custom record types

- **FR-53** A user with `CUSTOM_RECORD_TYPES_MANAGE` can create a record type without code: labels, key, icon, menu, scope
  (per organization, or tenant-wide with an allow-list), then fields, rules, layouts and actions as for any type.
- **FR-54** The system supports four kinds: list; lines of another type; tree (parent of the same type); single (one
  record per organization, for settings).
- **FR-55** The system identifies a custom record by a number from a numbering series, unique per organization, and a
  title from a field or formula.
- **FR-56** A user with `CUSTOM_RECORD_TYPES_MANAGE` can switch comments, attachments, followers, timeline, history,
  workflows, import, export, print, search and events per type; all on by default except workflows.
- **FR-57** A user with `CUSTOM_RECORD_TYPES_MANAGE` can grant per role view, create, edit, delete, export and import,
  scoped to own, team, organization or all, checked on every surface; super admins and admins hold all.
- **FR-58** The system gives a published custom record type list and detail pages, saved views, reports, REST and
  GraphQL, MCP tools, events, import, export and print with no further setup. The list page and saved views are the
  generic record list of `record-views-and-search`, a prerequisite of that part: while that feature is off for the
  tenant, the type's menu entry stays hidden and its records open by link to their detail form and through the REST,
  GraphQL and MCP lists. `(advanced)`
- **FR-59** A user with the type's permissions can create, edit (stale versions `409`), delete to the bin, restore,
  duplicate, reassign, and bulk create, update or delete records with per-row results.
- **FR-60** The system refuses deleting a type that has records; it can be deprecated (no new records) or archived.
- **FR-61** The system refuses a 201st custom record type per tenant, naming the limit.

### 3.11 Custom fields everywhere

- **FR-62** The system returns `customFieldValues` on detail reads of registered types and on list reads when asked, and
  accepts them on create and update in the record's transaction, all or nothing, for tenants with `FEATURE_CUSTOM_FIELDS`
  on; with it off, record routes answer and accept exactly as today.
- **FR-63** The system reads and replaces or merges one record's values with a version check, and writes many records'
  values in bulk with per-row results.
- **FR-64** The system answers per record type the fields, rules, layouts and actions resolved for the caller's roles,
  device and organization, cacheable by validator tag, and a machine-readable schema for SDK clients.
- **FR-65** The system exposes `customFieldValues` on registered GraphQL types and a record type's definitions.
- **FR-66** The system filters and sorts list routes of registered types by custom fields in the platform's one list
  filter syntax, with the operators saved views use (equals, one of, comparisons, between, empty, contains, starts with, by referenced record).
- **FR-67** The system offers every published field the user may view as a column, filter and grouping in reports.
- **FR-68** The system carries custom fields as columns of mapped imports (create, update) and exports, validated as
  FR-15 and the rules; choices match by key or label in any language, references by number, title or id.
- **FR-69** The system gives print templates custom fields by key, formatted by type and locale, minus hidden-in-print.
- **FR-70** The system finds records by their searchable custom fields in global search and pickers.
- **FR-71** The system puts changed custom values, before and after, in record events on the outbox and real-time channel.
- **FR-72** The system offers MCP tools to list definitions, read and write values, query and change custom records and
  run actions; every change takes `preview`.
- **FR-73** The system offers custom fields as columns of every Angular list of a registered type, edited in place there.

### 3.12 Field history and audit

- **FR-74** The system records each change of a field with history on (old and new value, who, when, source: person,
  import, automation, workflow, agent, formula, API client) for the record's life. `(advanced)`
- **FR-75** A user with the field's view permission can open its history; a user with `CUSTOM_FIELD_HISTORY_VIEW` can
  search changes across records.
- **FR-76** A user with the field's edit permission can restore an earlier value as a new, validated change.
  `(advanced)`
- **FR-77** The system audits every change of definitions, overrides, rules, layouts, actions, record types and their
  permissions (who, when, before, after).

### 3.13 Lifecycle, packages, agents and real time

- **FR-78** The system keeps customizations draft (preview only, not enforced), published, deprecated (out of new forms,
  readable, not required) or archived; nothing holding values is deleted. `(advanced)`
- **FR-79** The system lists, before a field is published, deprecated, archived or changed, its uses (layouts, rules,
  formulas, roll-ups, actions, workflows, automations, views, reports, print and import templates, API reads of 30 days)
  and the records holding a value. `(advanced)`
- **FR-80** The system refuses changing a published field's type in place; a conversion creates a new field from its
  values with a preview of converted and failed values, then deprecates the old field with its values kept.
- **FR-81** A user with `CUSTOM_FIELDS_MANAGE` can add, relabel, reorder and archive options; archived options keep showing.
- **FR-82** A user with `CUSTOMIZATION_PACKAGES_MANAGE` can export record types' whole customization as a package and
  import it into another organization or tenant with a diff, a choice per conflict (skip, rename, replace), as drafts or
  published, and undo it while nothing it created holds values. `(advanced)`
- **FR-83** The system lets plugins and marketplace apps ship fields, layouts and record types as packages; items show
  their source, change only through overrides, and are hidden, not deleted, when the plugin is disabled.
- **FR-84** A user with `CUSTOM_FIELDS_MANAGE` can describe a field, rule, layout or record type in a sentence; the
  assistant drafts it with preview and impact; only a person publishes it. `(advanced)`
- **FR-85** The system gives an agent filling a record the resolved layout and rules, validates its writes as a
  person's and marks them as an agent's in history. `(advanced)`
- **FR-86** The system sends publications to open clients through the real-time channel: open forms keep input and
  apply the change at next open; another user's saved values appear live with a notice. `(advanced)`

### 3.14 Reports

- **FR-87** The system registers these report definitions:

  | Report | Answers |
  |---|---|
  | Field fill rate | per type, organization and field: records with a value, share, trend |
  | Field change log | changes by field, user, source and period, old and new values |
  | Records by type | per custom record type: counts by owner, organization, state, period |
  | Computed field health | formula and roll-up fields: errors, records waiting, last run |
  | Customization inventory | per type: fields, rules, layouts, actions by status and source |

- **FR-93** The system lists the reports of FR-87 on the Reports page and in the Reports menu only for tenants with
  `FEATURE_CUSTOM_FIELDS` on; with it off, that page and menu show exactly today's reports.

### 3.15 Scripts on self-hosted installations

- **FR-88** The system offers tenant-written scripts only on a self-hosted installation whose operator turned the
  deployment switch on (off by default); the cloud deployment refuses the switch at start-up and answers `403` to every
  script route and script field there.
- **FR-89** A user with `CUSTOM_FIELD_SCRIPTS_MANAGE` can, where scripts are on, give a computed field a script instead
  of a formula: it reads the record's values and returns the field's value, and is tested, published and deprecated
  like a formula.
- **FR-90** The system runs each script in an isolated runtime without network, file or platform access, within a time
  limit (default 2 s) and a memory limit (default 64 MB); a failing or stopped script leaves the value empty and lists
  the record in the field's health view, as FR-30.
- **FR-91** The system audits every script run (script and version, record, actor, duration, memory, outcome) and every
  script change (who, when, before, after), readable by holders of `CUSTOM_FIELD_SCRIPTS_MANAGE`.

## 4. Non-Functional Requirements

- **Performance**: a 50-record list with 10 custom columns and 2 custom filters under 300 ms P95 at one million records
  and 20 million values per tenant (PostgreSQL, MySQL); a save with 30 values adds under 40 ms; resolved metadata under
  50 ms and cached; a formula under 5 ms per record; roll-ups fresh within 60 s P95.
- **Limits**: per type 300 fields, 100 rules, 50 layouts, 30 actions; 200 custom types per tenant; formulas ≤ 2,000 chars.
- **Concurrency and reliability**: version checks on records, values and drafts; recomputation never overwrites a newer
  value; computed values derived at least once through the outbox and deduplicated; a nightly pass repairs drift.
- **Security & privacy**: values carry their record's tenant and organization; masks on every surface; values leave the
  platform only through the record's existing surfaces under the same masks; https-only actions; sanitised input;
  scripts never on the cloud deployment, isolated, bounded and audited where a self-hosted operator allows them.
- **Observability**: audit of definition changes, history of values, metrics for refusals, formula errors and lag.
- **Accessibility and localization**: keyboard equivalents for the designer and condition builder; announced labels and
  errors; labels, options and messages per language; values in the user's locale.
- **Compatibility**: PostgreSQL, MySQL, SQLite; both ORMs; cloud and self-hosted alike; OpenAPI additive; SDKs regenerated.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| Record type, record type settings | A kind of record (standard, plugin, custom) in one registry; its per-type settings |
| Custom field | A user-defined field of a record type with type, options, behaviour and status |
| Standard field override | A change of a standard field's label, order, visibility, default or required flag |
| Field rule, formula | A condition-driven behaviour of a field or section; an expression in the formula language |
| Computed field | A formula, roll-up or auto-number field maintained by the system |
| Form layout, form action | An arrangement of fields of one kind for an audience and device; a button on a record |
| Custom record type, custom record | A record type created without code; one record of it |
| Custom field value, field change | The value of one field on one record; one recorded change of it with its source |
| Record template, user default | Saved values to start records from; a user's own field default |
| Customization package | A portable set of definitions, with its import runs |

## 6. Out of Scope

- Saved views, filter bar, bulk actions, global search index: `record-views-and-search` (uses this spec's filters).
- Workflow states, transitions, approvals and state badges: `approval-workflows`; automation flows: `automation-and-notifications`.
- Numbering series administration and conditional numbering: `business-document-engine`.
- Report builder: `report-builder-and-dashboards`; import and export screens: `data-import-export`; print designer:
  `print-and-pdf-designer`; webhook transport: `integration-hub`; agent runtime: `ai-agents-and-assistants`.
- Field-level permissions on standard fields and record-level sharing: `access-control-and-security`.
- Web forms that create records: `lead-capture-and-enrichment`; branding (name, logo, favicon): `organization-setup`.

## 7. Acceptance Criteria

- [ ] **AC-1** A contact date field reaches form, list, filter, report, import, export, print and API with no restart (FR-66–FR-68).
- [ ] **AC-2** Required, unique, bounds, masks and fixed values are enforced alike by form, REST, GraphQL, bulk, import, MCP (FR-14, FR-15).
- [ ] **AC-3** Dependent options, required-when, copy and validations agree in the Angular app and server; cycles fail (FR-20).
- [ ] **AC-4** Formulas are stored and filterable; a time-log roll-up updates within a minute (advanced: computed; FR-27–FR-29).
- [ ] **AC-5** Layouts resolve per role and device; a phone layout renders in the web app on a phone (advanced: layouts; FR-35, FR-37).
- [ ] **AC-6** Quick entry creates and selects a record; lines save with their parent all or nothing (FR-43, FR-45).
- [ ] **AC-7** A published custom type has reports, API, events, import and MCP at once, and its list and views at once
      where `record-views-and-search` is on; other roles are refused (advanced: day-one record types; FR-58).
- [ ] **AC-8** Each action kind runs with the user's permissions; bulk reports per record; no tenant code runs on the cloud (FR-51, FR-52).
- [ ] **AC-9** Field history shows sources and restores; the change log lists it (advanced: history; FR-74–FR-77).
- [ ] **AC-10** Lifecycle, conversion and impact analysis behave as stated (advanced: safe rollout; FR-78–FR-80).
- [ ] **AC-11** A package imports into another tenant with a diff and undoes cleanly (advanced: packages; FR-82).
- [ ] **AC-12** A field of one organization is ignored by another's forms and reports (advanced: variants; FR-19).
- [ ] **AC-13** The assistant drafts and only a person publishes; agent writes are marked; a publication reaches an open
      client without losing input (advanced: agents, real time; FR-84–FR-86).
- [ ] **AC-14** The five reports of FR-87 return correct figures on seeded data.
- [ ] **AC-15** Feature off: `404` everywhere, forms unchanged, record routes answer exactly as today (no
      `customFieldValues`), the Reports page and menu unchanged, code-declared fields work; the §4 list budget holds.
- [ ] **AC-16** The cloud deployment refuses the script switch and answers `403` to script fields; on a self-hosted
      installation with the switch on, a script field computes, a script over its limits is stopped, and every run is audited (FR-88, FR-89, FR-91).
- [ ] **AC-17** Feature on: contacts, deals, vendors, projects, employees and items keep their existing forms with a
      custom field section until an administrator switches the type to layout rendering; switching back restores them (FR-5).
- [ ] **AC-18** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-1).
- [ ] Works on PostgreSQL, MySQL and SQLite with both ORMs; all functional requirements have a passing test.

## 8. Open Questions

- Tenant-written scripts: never on the cloud; self-hosted only, behind the deployment switch, off by default (FR-88).
- Definitions tenant-wide with an organization allow-list (FR-19), not per organization. Default applied.
- History kept for the record's life; first pages that can switch to layout rendering (each off until an administrator
  switches it): contacts, deals, vendors, projects, employees, items (FR-41); `customFieldValues` on list reads only when
  asked. Defaults applied.

## 9. Constitution Gates

- [x] I Plugin-first — plugin pair `custom-fields`; core gains the registry, a filter hook and the script runtime.
- [x] II Tenant/organization scoping — every definition, value, record and change carries tenant and organization.
- [x] III Both ORMs, additive migrations — fixed tables on every dialect; no run-time schema change.
- [x] IV Default-off flag; nothing removed — tenant feature plus deploy switch; code-declared fields unchanged.
- [x] V Contracts and API first — REST, GraphQL, schema per type, SDKs; `customFieldValues` is additive.
- [x] VI Permissions, privacy, security — manage permissions, masks everywhere, no tenant code on the cloud, https actions.
- [x] VII Real-time through the event bus — value changes and publications through the outbox and real-time channel.
- [x] VIII i18n and accessibility — labels per language, keyboard designer, announced errors.
- [x] IX Tests accompany the change — per requirement, with ORM parity and dialect specs.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Works with: [`approval-workflows`](../approval-workflows/spec.md), [`record-views-and-search`](../record-views-and-search/spec.md),
  [`data-import-export`](../data-import-export/spec.md), [`business-document-engine`](../business-document-engine/spec.md)
- Code: `packages/core/src/lib/core/entities/custom-entity-fields/`, `packages/core/src/lib/rule/`
