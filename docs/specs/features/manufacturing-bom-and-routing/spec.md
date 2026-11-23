# Feature Specification: Bills of materials and routings

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `manufacturing-bom-and-routing`
**Branch**: `feat/manufacturing-bom-and-routing`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_MANUFACTURING` (new, default off; needs `FEATURE_CATALOG`; costs from stock values also need
`FEATURE_INVENTORY_VALUATION`)

---

## 1. Overview

Today an item has variants and options, but nothing says what it is made of or how. This feature adds the structure
part of the new `manufacturing` plugin: **bills of materials** (components, secondary outputs, expected loss),
**operations** and reusable **routings** (ordered steps at work centres with times), **multi-level explosion**,
**costing** rolled up through every level, **versions** with effective dates and **change requests**, tools that turn a
design into structures, compare and replace them and refresh their cost, and structure reports. Work orders, planning,
subcontracting, procurement and sales read structures from here. Clients: the Angular app, MCP agents, API and SDKs.

**Advanced capabilities.** One structure model: step outputs are an optional property of a routed operation,
and every rule shows as a live checklist while editing. Versions carry effective dates and are released through change
requests in the approval engine, with a visual comparison, a cost roll-up simulation over every parent and open work
order and an impact list before anyone approves. Variant structures come from attribute rules and are regenerated with
a reviewed difference. An agent drafts a structure from a description, a parts list or a design file with a preview and
explains cost drivers. Editors see each other live. These requirements are marked `(advanced)`.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** an item "Desk D" and a user with `MANUFACTURING_STRUCTURES_EDIT`, **when** they create a bill of materials
  yielding 1 desk from 1 top, 4 legs and 16 screws with the routing "cut, assemble, finish" and release it, **then** it
  is numbered by its series, becomes the desk's default, and work orders, plans and subcontract services take it.
- **Given** "Leg L" has its own released bill of materials, **when** the engineer opens the desk's explosion, **then**
  the tree shows the leg's components multiplied by 4 per desk; with "keep as stocked" on the leg line the leg stays a
  bought or stocked item and is not exploded.
- **Given** the desk's rate basis "valuation rate", the work centre "CNC" at 60 per hour and a cut time of 12 minutes,
  **when** the cost is updated, **then** the desk shows component cost, operating cost 12.00, secondary output credit and
  unit cost in the structure's and the organization's currency, each figure with its source.
- **Given** a template desk structure whose top line says "top in the same wood as the desk", **when** the engineer
  generates structures for all wood variants, **then** a preview lists one structure per variant with the oak, ash and
  walnut tops, and the walnut line is flagged because no walnut top exists.
- **Given** a released version 1, **when** the engineer drafts version 2 with 12 screws and a glue line, raises a change
  request effective 1 December and an approver accepts it, **then** version 2 is released effective 1 December, version 1
  ends on 30 November, and the request shows the comparison, the new unit cost of the desk and of its 3 parents, and the
  open work orders that keep version 1.
- **Given** a parts list exported from a design tool, **when** the engineer imports it as a design and confirms it,
  **then** a background job creates the multi-level draft structures, proposes the 7 missing items with the
  organization's item defaults, and reports each node as created, linked or failed.
- **Given** sub-assembly structure "Frame F v3" used by 14 parents, **when** a user with `MANUFACTURING_STRUCTURES_RELEASE`
  replaces it by "Frame F v4", **then** a preview lists the 14 parents, the job replaces it in each and logs the result.
- **Given** an agent with read permissions, **when** asked "can we make 50 desks from the main warehouse?", **then** it
  answers per component with required, available and missing quantities.

### 2.2 Edge cases & failures

- **Given** a structure that would contain itself at any level, **when** it is saved, **then** it is refused naming the
  path (desk → frame → desk).
- **Given** a component that is a fixed asset, disabled, past its end of life or not usable by the organization, **when**
  the line is saved, **then** it is refused with the reason.
- **Given** percentage components totalling 98 % and no balance line, **when** the structure is saved, **then** it is
  refused showing the missing 2 %; two balance lines are refused.
- **Given** a released structure, **when** someone edits a line, **then** the edit is refused and a new version is offered.
- **Given** a structure used as sub-assembly by a released parent, **when** someone retires it, **then** it is refused
  listing the parents.
- **Given** two released versions whose effective dates would overlap, **when** the second is released, **then** it is
  refused naming the overlap.
- **Given** two engineers saving the same draft, **when** the second save arrives based on an older version, **then** it
  is refused (409) with the changes made meanwhile.
- **Given** a change request rejected by the approver, **when** the engineer opens it, **then** the draft is editable again
  with the reason shown, and nothing was released.
- **Given** a cost refresh already running in the organization, **when** another is started, **then** it is refused with
  the running refresh's progress; the daily refresh is skipped while one runs.
- **Given** secondary outputs valued above the component cost, or cost shares not totalling 100 %, **when** the structure
  is saved, **then** it is refused with the figures.
- **Given** a user without `MANUFACTURING_COSTS_VIEW`, **when** they read a structure, **then** no rate or cost is answered.
- **Given** `FEATURE_MANUFACTURING` off, **when** a structure route or tool is called, **then** it answers 404 and the menu
  is hidden.

## 3. Functional Requirements

### 3.1 Scope and compatibility

- **FR-1** The system gates every structure route, menu entry, field and MCP tool with `FEATURE_MANUFACTURING`; with it
  off, routes answer 404 and other areas behave as if no structure existed.
- **FR-2** The system writes no stock movement, value layer or ledger line from a structure; costs are computed from
  values other areas own and are stored on the structure only as its cost figures.
- **FR-3** The system accepts as components, outputs and operation places only items, variants and work centres of the
  structure's organization or allowed for it by their allow-list.
- **FR-4** The system answers other areas, for an item and a date: the effective bill of materials, its explosion to
  bought or stocked items for a quantity, its operations and its secondary outputs.

### 3.2 Bills of materials

- **FR-5** A user with `MANUFACTURING_STRUCTURES_EDIT` can create a bill of materials for an item variant: the quantity
  it yields with its unit, currency, description, optional project and notes; it is numbered by the organization's
  numbering series for structures, by default `<item code>/v<version>`.
- **FR-6** The system refuses a yielded quantity at or below zero, or with decimals in a unit that only takes whole numbers,
  and a bill of materials for an item sold as a kit: a kit's components are kept once, on the kit.
- **FR-7** A user with `MANUFACTURING_STRUCTURES_EDIT` can add component lines: item variant, quantity per yielded
  quantity, unit of the item's unit family (converted to the stock unit with the item's conversions), source location,
  note, the item's image, optional operation where it is consumed, and position.
- **FR-8** The system refuses a component at or below zero quantity, a fixed-asset item, a disabled item, an item whose end
  of life falls before the structure's effective-from date, and the yielded item itself; a second line for the same item
  at the same operation is warned and can be merged.
- **FR-9** A bill of materials is draft, released or retired; only a draft is editable; a released one changes only
  through a new version (FR-34); retiring needs `MANUFACTURING_STRUCTURES_RELEASE`.
- **FR-10** The system keeps at most one default released bill of materials per item variant; making one default unsets
  the previous default in the same change and records it as the item's default for work orders, plans, subcontract
  services and selling.
- **FR-11** The system refuses to retire a bill of materials used as sub-assembly by a released parent, listing the
  parents, and refuses to release one whose sub-assemblies are not released.
- **FR-12** A bill of materials may name default source and target locations, copied to work orders made from it.
- **FR-13** A component line may be marked supplied by the customer or supplied by the subcontractor (never issued from
  own stock), or not issued (kept on the structure for cost and planning, left out of production movements).
- **FR-14** A component line may allow substitutes: the item's alternatives from the catalogue with their ratio, and
  further substitutes listed on the line with priority and ratio; work orders choose among them and keep the original.
- **FR-15** A bill of materials may state components as percentages of the batch; the system refuses it unless the
  percentages total 100 within the unit's rounding or exactly one balance line takes the rest, and unless the batch unit
  converts to every component unit.
- **FR-16** A user with `MANUFACTURING_STRUCTURES_EDIT` can list secondary outputs: co-product, by-product, scrap or extra
  output, each with item, quantity, unit, process loss percent below 100 and valuation (item rate, stated cost, or a
  percent of component cost).
- **FR-17** The system refuses a duplicate item and kind among secondary outputs, the yielded item as a secondary output
  unless valued by item rate, secondary outputs valued above the component cost, and percent shares of the yielded item
  and percent-valued outputs that do not total 100.
- **FR-18** A bill of materials may state expected process loss as a percent below 100 or as a quantity; the other figure
  is derived, and work orders plan the input for the output plus the loss.
- **FR-19** A bill of materials, and each of its operations, may require inspection of the output with an inspection
  template of quality management; switching it off clears the template; without quality management the requirement is
  kept and the editor says it is not enforced.

### 3.3 Multi-level structures

- **FR-20** A component may name a sub-assembly bill of materials (default: the component's effective default); the system
  explodes the tree into a flat list with quantities rolled up through every level, recomputed on save and on cost update.
- **FR-21** A component marked "keep as stocked" is not exploded: it is read as a stocked or bought item at its level.
- **FR-22** A bill of materials of a non-stocked item may be marked phantom: wherever a parent is read (explosion, work
  orders, requisitions, cost) its components are merged into the parent by item; a phantom of a stocked item is refused.
- **FR-23** The system refuses a save that would make a bill of materials its own ancestor or descendant, naming the path.
- **FR-24** A user with `MANUFACTURING_STRUCTURES_VIEW` can browse a structure as an expandable tree with quantity per
  parent and per top unit, phantom and keep-as-stocked markers and, with `MANUFACTURING_COSTS_VIEW`, cost per level.
- **FR-25** The editor shows, as the structure is edited, a checklist of every rule of this section and §3.4 with its
  state, and offers the fix where one exists (merge duplicates, add a balance line, pick a routing). `(advanced)`

### 3.4 Operations and routings

- **FR-26** A user with `MANUFACTURING_STRUCTURES_EDIT` can define operations: name, default work centre or work-centre
  group, description, work instructions (formatted text, images, files, video links), operation-steps with minutes (the
  total is derived), a corrective flag, an inspection template and a batch size for splitting operation cards.
- **FR-27** A user with `MANUFACTURING_STRUCTURES_EDIT` can define a routing: an ordered list of operations whose
  sequence numbers start at 1 and never skip a number; operations sharing a number run in parallel; a routing can be
  deactivated and an inactive routing cannot be chosen.
- **FR-28** A bill of materials may carry operations, pulled from a routing or entered: each with a work centre or
  group, set-up minutes, run minutes per unit or per batch of a stated size, a fixed-time flag (does not scale with
  quantity) and the hourly rate of its work centre; the system refuses an operation without a place or run time.
- **FR-29** Instead of operations, a bill of materials may state one flat operating cost per yielded quantity; the
  editor offers one or the other.
- **FR-30** Each operation states where its materials come from (issued to the work order, issued per operation card,
  consumed from the source location at completion, or backflushed from work in progress), its work-in-progress and
  output locations, whether it is subcontracted, whether its output is inspected and its card batch size; blanks take the
  structure's, then the organization's defaults.
- **FR-31** A bill of materials with operations states whether materials are issued for the whole work order or per
  operation card, and whether consumption at completion follows the structure's quantities or what was issued.
- **FR-32** An operation may yield a named intermediate item with quantity, locations and its own sub-structure; then
  components attach to the operation that consumes them, exactly one last operation yields the structure's item, an
  operation may take its materials from another structure, and an operation that splits output into pieces states the
  weight per piece; the editor shows per operation whether its materials and output are complete.
- **FR-33** Step outputs are a property of operations of the same structure, so a structure with and without them is
  edited, costed, compared and exploded the same way. `(advanced)`

### 3.5 Versions, effectivity and change requests `(advanced)`

- **FR-34** A user with `MANUFACTURING_STRUCTURES_EDIT` can make a new version of a released bill of materials: a draft
  copy with the next version number of the item; older versions stay readable.
- **FR-35** A released version carries an effective-from date and an optional effective-until date; versions of one item
  variant may not overlap; releasing a version effective from a date ends the previous one the day before; for a date,
  work orders and plans take the version effective that day.
- **FR-36** With the organization's change control on, a draft version, a replacement (FR-55) or a retirement is released
  only through a change request: reason, structures affected, proposed effective date, comparison, cost simulation and
  impact, decided as a "structure change" approval request on the platform's Approvals page by the approvers of its
  approval policy (or its approval workflow when workflows are on).
- **FR-37** An approved change request releases its versions at their effective dates in one change; a rejected one
  returns them to draft with the reason; a cancelled one releases nothing.
- **FR-38** A user with `MANUFACTURING_STRUCTURES_VIEW` can compare two versions, or two bills of materials of one item:
  components, substitutes, operations, secondary outputs and costs, matched by item and operation and then field by field,
  as added, removed and changed, side by side and as a tree with text markers besides colour.
- **FR-39** Before release the system simulates the cost roll-up: the new unit cost of the item and of every parent up to
  the top, and the change in planned cost of open work orders and planned production, writing nothing.
- **FR-40** Before release the system lists open work orders, production plans, subcontract services and sales lines that
  use the outgoing version, and whether each keeps it or follows the effective date.
- **FR-41** On release of a structure whose item is valued at standard cost, the system proposes a dated standard cost to
  stock valuation; it is applied only by a user with the valuation permission.

### 3.6 Variant structures

- **FR-42** A bill of materials of an item with variants is a template: a line names a fixed variant or an item with
  variants plus a rule (same value of an attribute as the variant made, or a value map); a template is never used by a
  work order or plan, and a work order for a template item is refused.
- **FR-43** A user with `MANUFACTURING_STRUCTURES_EDIT` can generate structures for one or all variants of a template:
  each line resolved by its rule, unresolved lines listed, the result previewed before anything is created.
- **FR-44** When a template changes, the system offers to regenerate its variant structures, showing each difference;
  nothing changes without confirmation. `(advanced)`

### 3.7 Costing

- **FR-45** A bill of materials states its component rate basis: valuation rate (the item's cost price when stock
  valuation is off), last purchase price (the unit cost of the item's latest goods receipt), or a buying price list;
  price-list prices are converted at the rate of the costing date and the list's currency must be the structure's or the
  organization's.
- **FR-46** The system computes operating cost as hourly rate × minutes ÷ 60, per unit when timed per batch, without
  scaling fixed-time operations, and spreads set-up time over the yielded quantity.
- **FR-47** The system computes component cost, operating cost, secondary output credit, total and unit cost in the
  structure's and the organization's currency, and records basis, date and rate used.
- **FR-48** A user with `MANUFACTURING_STRUCTURES_COST` can update one structure's cost and propagate it to every parent,
  level by level from the bottom, optionally refreshing operation rates from their work centres.
- **FR-49** A user with `MANUFACTURING_STRUCTURES_COST` can refresh the cost of every structure of the organization as a
  platform background operation, level by level in batches, with progress, resumption after interruption and a failure
  per structure; one refresh per organization at a time.
- **FR-50** With the organization setting on, the system starts a refresh daily unless one is running; every run stays
  listed with the platform's background operations.
- **FR-51** A user with `MANUFACTURING_COSTS_VIEW` can open a cost breakdown per level, component, operation (labour,
  machine and overhead parts when the work centre splits its rate) and secondary output, each figure with its source.

### 3.8 Designs to structures

- **FR-52** A user with `MANUFACTURING_DESIGNS_EDIT` can build a design: a tree of assemblies and parts with quantity,
  unit, existing item or item to create, rate, operation and work instruction; confirming it creates the multi-level
  structures, draft or released as chosen, in a background job that creates missing items with the organization's item
  defaults and reports each node as created, linked or failed.
- **FR-53** A confirmed design is locked; building again is refused while its structures exist; the design shows whether
  structures are being built, built or failed, and whether a newer revision replaced it.
- **FR-54** A user with `MANUFACTURING_DESIGNS_EDIT` can attach a design file (a parts list in spreadsheet or delimited
  text, or a 3D assembly in STEP or glTF) whose part tree is imported; re-import updates parts from the file and keeps parts
  added by hand; parts from the file cannot be removed by hand; an assembly removed in the file drops its hand-added
  children with a notice; parts may carry a 3D model and placement shown in a viewer.
- **FR-55** A user with `MANUFACTURING_DESIGNS_EDIT` can revise a confirmed design: the system lists added and removed
  parts and changed quantities, marks the previous revision replaced, refuses building from a replaced revision, and
  turns the changes into new versions through a change request when structures exist.
- **FR-56** A design may define operations with work-centre group, time, output part and which materials come from which
  earlier operation, producing step outputs (FR-32) or a routed structure; a phantom design with step outputs is refused,
  and operations without step outputs need a routing.

### 3.9 Update tools

- **FR-57** A user with `MANUFACTURING_STRUCTURES_RELEASE` can replace one sub-assembly structure by another in every
  parent that uses it, after a preview of the parents, as a logged background job; replacing a structure by itself is
  refused; parents whose step outputs name it are skipped and listed; with change control on, one change request covers
  the replacement.
- **FR-58** Every cost refresh, replacement and design build keeps its state, counts and failures, visible in the
  platform's list of background operations.

### 3.10 Publishing

- **FR-59** A released bill of materials may be published with an image, a long description and whether its components
  and operations show; the public read feed then answers that read-only view, never costs, suppliers or locations, for
  public websites built with Ever Works.

### 3.11 Lookups and reports

- **FR-60** A user with `MANUFACTURING_STRUCTURES_VIEW` can ask where an item is used: as a component at any level, as
  yielded or secondary output, as a substitute, in bundles and kits, in subcontract services and as variant or template.
- **FR-61** A user with `MANUFACTURING_STRUCTURES_VIEW` can find the structures that use all of up to five items, also
  through sub-assemblies.
- **FR-62** The system ships these report definitions, filterable by organization, item and structure, exportable and with
  drill-down to the structure:

  | Report | Answers |
  |---|---|
  | Structure explorer | the full exploded tree of a structure with levels, phantom and keep-as-stocked markers |
  | Can we make | for a quantity and a location: per component required, free stock, shortfall, next receipt date and the shortfall's cost |
  | Operation times | set-up and run minutes per unit of each structure by work centre, through all its levels |
  | Consumption variance | for completed work orders, consumed against required quantity and value per component |
  | Where used | every reference of an item (FR-60) |
  | Multi-item search | structures using a set of items (FR-61) |
  | Structure cost | unit cost per structure with its parts and the date and basis of the last costing |
  | Change history | versions, effective dates, change requests and their decisions per item |

### 3.12 Settings, exchange and print

- **FR-63** A user with `MANUFACTURING_SETTINGS_EDIT` can set per organization: default rate basis, default material
  source and issue mode, default consumption basis, change control on or off, automatic daily cost refresh and the
  numbering series of structures and designs.
- **FR-64** The system imports and exports structures, operations and routings through mapped imports with per-row
  validation and update by number.
- **FR-65** The system ships print templates for a bill of materials (multi-level, quantities, operations, costs optional)
  and a routing sheet with work instructions.

### 3.13 Agents and real time `(advanced)`

- **FR-66** The system offers MCP tools under the caller's permissions: explain a structure and its cost drivers, where
  used, can we make, compare versions, simulate a change's cost, and draft a structure from text, a parts list or a
  design with `preview` true by default, returning matched items, items to create and rule issues; drafting never releases.
- **FR-67** People viewing a structure see who else has it open; saves, releases, change-request decisions and cost
  updates reach open screens through the real-time channel within 2 s.
- **FR-68** The system publishes structure created, released, retired, default changed, cost updated and change request
  decided events for automation rules, webhooks and other areas.

## 4. Non-Functional Requirements

- **Performance**: structure lists P95 under 300 ms at 200,000 structures per organization; saving a 300-line draft
  under 500 ms; exploding a 10-level, 2,000-line tree under 1 s; where-used under 500 ms over 2 million component lines;
  comparing two 500-line versions under 1 s; a refresh of 10,000 structures under 10 minutes; building a 5,000-part
  design under 2 minutes.
- **Concurrency and reliability**: every write states the version it read (`If-Match`); one default per variant and
  non-overlapping dates hold under concurrent releases, done in one transaction; jobs lock per organization and resume.
- **Security & privacy**: rates and costs only with `MANUFACTURING_COSTS_VIEW`, removed from answers otherwise; design
  files pass the platform's upload checks, at most 200 MB; published views omit costs, suppliers and locations; nothing
  leaves the platform except published views and exports a user starts.
- **Auditability**: who, when, before and after for every release, retirement, default change, effectivity, replacement
  and change-request decision.
- **Accessibility and localization**: keyboard-operable, labelled tree and editors; differences marked by text as well as
  colour; strings in every locale.
- **Compatibility**: PostgreSQL, MySQL, SQLite; both ORMs; additive migrations; cloud and self-hosted.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| --- | --- |
| Bill of materials | What one item variant is made of, for a yielded quantity, with lifecycle, version and effective dates |
| Component line | An item consumed by the structure, with quantity, unit, source, flags and substitutes |
| Secondary output | A co-product, by-product, scrap or extra output of the structure with its valuation |
| Operation | A reusable named step with default place, instructions, operation-steps and inspection |
| Routing | A reusable ordered list of operations |
| Structure operation | An operation on one structure with place, times, material source, locations and optional step output |
| Explosion | The flat list of a structure's components rolled up through all levels |
| Template structure | A structure of an item with variants whose lines resolve per variant by attribute rules |
| Change request | A reasoned, approved release of new versions, replacements or retirements |
| Cost roll-up | Component, operating and secondary-output cost of a structure through its levels |
| Design | A part tree, possibly from a design file, from which structures are built, with revisions |
| Structure run | A cost refresh, replacement or design build run as a platform background operation |

## 6. Out of Scope

- Work centres, their groups, calendars and hourly rates; work orders and operation cards: `shop-floor-and-work-orders`.
- Production plans, material requirements and scheduling: `production-planning`.
- Items, variants, units and conversions, alternatives, manufacturers, bundles and kits: `item-catalogue`. Spare-part
  and accessory relations of the catalogue stay commercial links and are never read as components.
- Valuation rates and standard costs: `stock-ledger-and-valuation`. Buying price lists: `pricing-and-promotions`. Goods
  receipts and their unit costs: `procurement`.
- Inspection templates and inspections: `quality-management`. Subcontract services: `subcontracting`.
- Approval requests and the Approvals page: the platform's approvals, routed by `approval-workflows` when on. Numbering
  series: `business-document-engine`. Report engine: `report-builder-and-dashboards`. Mapped imports:
  `data-import-export`. Print designer: `print-and-pdf-designer`.
- Rendering of published structures on public websites: built with Ever Works over the public read feed.

## 7. Acceptance Criteria

- [ ] **AC-1** A desk structure with 3 components and a 3-operation routing is created, released, made default and read
      by the work-order and subcontracting ports with the same explosion and operations (FR-7, FR-9, FR-10).
- [ ] **AC-2** A two-level explosion multiplies sub-assembly quantities; keep-as-stocked stops explosion; a phantom merges;
      a cycle is refused naming the path (FR-20–FR-22).
- [ ] **AC-3** Percentage formulation, secondary outputs and process loss refuse each invalid case of FR-15, FR-17, FR-18.
- [ ] **AC-4** Cost update gives the expected unit cost for each rate basis and propagates to parents; the bulk refresh
      resumes after a forced stop and refuses a second run (FR-47, FR-48).
- [ ] **AC-5** A change request for version 2 shows the comparison, cost simulation and impact; approval releases it and
      ends version 1 the day before; rejection releases nothing. (advanced) (FR-36, FR-37, FR-39)
- [ ] **AC-6** A template generates variant structures with a preview and flags unresolved lines; a template change
      offers regeneration with differences. (advanced) (FR-43, FR-44)
- [ ] **AC-7** A parts-list design builds a three-level structure and creates missing items; a revision lists changes and
      blocks building from the replaced one (FR-52, FR-55).
- [ ] **AC-8** A replacement over 14 parents logs each parent and skips step-output parents (FR-57).
- [ ] **AC-9** The agent drafts a structure from text with `preview: true`, writes nothing, and explains a structure's
      cost drivers. (advanced) (FR-66)
- [ ] **AC-10** Two browsers on the same structure see presence and each other's saves within 2 s; an older-version save
      gets 409. (advanced) (FR-67)
- [ ] **AC-11** Each report of FR-62 returns data on the demo tenant and drills down to the structure.
- [ ] **AC-12** Costs are absent from answers without `MANUFACTURING_COSTS_VIEW`; works on PostgreSQL, MySQL and SQLite
      with both ORMs; behind `FEATURE_MANUFACTURING`; nothing changes while it is off; every requirement has a test (FR-51; §4).
- [ ] **AC-13** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-1).

## 8. Open Questions

- Design file formats (FR-54): default parts lists plus STEP and glTF assemblies; native files later as connectors.
- Phantom operations (FR-22): default only components merge; a phantom's own operations are ignored with a warning.
- Change control (FR-36): default off per organization; releasing then needs `MANUFACTURING_STRUCTURES_RELEASE`.
- Effectivity by lot or serial range (FR-35): default dates only. Publishing (FR-59): kept, off per structure.

## 9. Constitution Gates

- [x] I Plugin-first — new plugin `packages/plugins/manufacturing` with `manufacturing-ui` and `manufacturing-react-ui`;
      catalogue, stock, valuation, prices and quality reached through ports; approvals are the platform's approval
      requests.
- [x] II Tenant/organization scoping — every structure, operation, design and job scoped to tenant and organization.
- [x] III Both ORMs, additive migrations — new tables only, three dialects, both ORMs.
- [x] IV Default-off flag; nothing removed — `FEATURE_MANUFACTURING` off; no existing item behaviour changes.
- [x] V Contracts and API first — contracts and REST before screens; OpenAPI additive.
- [x] VI Permissions, privacy, security — separate view, edit, release, cost and design keys; costs removed without the
      cost key; uploads checked; published views stripped.
- [x] VII Real-time through the event bus — outbox events and real-time hints; presence through the platform channel.
- [x] VIII i18n and accessibility — strings in every locale; keyboard tree and comparison with text markers.
- [x] IX Tests accompany the change — each requirement has a test in the tasks.
- [x] X Behaviour-first — this document.
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Code: `packages/core/src/lib/product-variant/`, `packages/core/src/lib/measurement/`, `packages/plugins/catalog/src/lib/`
- Related specs: `../item-catalogue/spec.md`, `../shop-floor-and-work-orders/spec.md`, `../production-planning/spec.md`,
  `../subcontracting/spec.md`, `../stock-ledger-and-valuation/spec.md`, `../procurement/spec.md`
