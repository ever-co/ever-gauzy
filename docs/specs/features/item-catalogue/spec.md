# Feature Specification: Item catalogue

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `item-catalogue`
**Branch**: `feat/item-catalogue`
**Status**: `Draft`
**Created**: 2026-11-15
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_CATALOG` (existing tenant feature, default on; from now on read by a guard on every
catalogue route and by the menu) and `FEATURE_ITEM_MASTER` (new tenant feature, default off: every behaviour this
spec adds)

---

## 1. Overview

One item master for everything an organization sells, buys, stocks, rents or makes. Items, variants, categories,
option groups, translations and galleries already exist and have screens (Inventory); units of measure, channel
publication, collections, relations and variant media exist as API only. This feature completes the item record and
makes it usable on every document: item kinds and their rules, item groups and brands with inherited defaults, units
with item-specific packaging conversions, several barcodes per item, attribute-driven variant generation,
alternatives, manufacturers and part numbers, customer item codes, sales bundles and assembled kits, buying and
commercial attributes read by the pricing, purchasing, tax and document engines, item search, item reports, and
screens for the catalogue back end. Clients: the Gauzy Angular app (the Inventory pages are extended, master pages
are added by a catalogue UI plugin), the REST and GraphQL API, the MCP server and the SDKs; the register of
`point-of-sale-and-loyalty` and the existing cart and checkout read items through the same API.

**Advanced capabilities.** Item data is maintained the way a team works rather than one form at a time: duplicate
detection on create and import plus the platform's nightly duplicate scan with merge; a previewed bulk edit of thousands of items
with per-row results and a 24-hour undo; AI drafts of missing translations; MCP tools that let an agent search,
create (with preview), generate variants and clean up the catalogue under the caller's permissions; a completeness
score per channel and language; live updates of item lists and registers through the real-time channel; and defaults
that resolve live from item, brand and group with an answer to "where does this value come from".

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** a manager with `PRODUCTS_EDIT`, **when** they create "Espresso beans 1 kg" in the group "Coffee", brand
  "House roast", stock unit "piece", purchase unit "case of 12", kinds stock item, sold and purchased, **then** the
  item gets a code from the organization's series, the case conversion is stored for this item only, and the default
  stock location and supplier on the form come from the group, each marked "from group Coffee".
- **Given** that item with barcodes `4006381333931` (EAN-13, piece) and `14006381333938` (GTIN-14, case), **when**
  the second code is scanned on any document that uses the lookup, **then** it resolves to the item, the unit "case"
  and 12 pieces.
- **Given** the attributes "Size" (S, M, L) and "Colour" (Red, Blue), **when** a manager applies both to the template
  "T-shirt" and chooses **Generate all**, **then** a preview lists six variants with codes such as `TSHIRT-S-RED`;
  after confirming, six variants exist and inherit the template's group, brand, units and tax category, and, where
  the organization keeps templates off documents (FR-31), the template is no longer offered on documents.
- **Given** a sales bundle "Starter kit" (a grinder, a scale, two bags of beans), **when** it is sold on an order,
  **then** the line carries the bundle's price, stock and delivery work on the component lines, and the bundle shows
  as available in the number of sets its scarcest component allows.
- **Given** a customer whose own code for the beans is `CUST-778`, **when** it is typed in a picker of that
  customer's document, **then** the beans are found and that customer's documents print both codes.
- **Given** 1,200 selected items of the group "Tea", **when** a manager chooses **Bulk edit → brand and sales unit**,
  **then** a preview lists each item's before and after values and the rows that would be refused; **Apply** runs in
  the background with a result per row, and **Undo** restores the previous values for 24 hours.
- **Given** "Espresso beans 1 kg" exists, **when** a manager saves "Expresso beans 1kg", **then** they are warned
  with the likely duplicate and its score and may open it or continue with a reason.
- **Given** an AI agent whose key holds `PRODUCTS_EDIT`, **when** it calls the item creation tool with `preview:
  true`, **then** it receives the item as it would be saved, its inherited defaults and the duplicates it collides
  with, and nothing is saved.

### 2.2 Edge cases & failures

- **Given** a user without `PRODUCTS_EDIT`, **when** they call a write route, **then** they receive `403`; with
  `FEATURE_ITEM_MASTER` off, every route this spec adds answers `404` and its screens and menu entries are hidden.
- **Given** two managers editing one item, **when** the second saves an outdated version, **then** it is refused
  with `409` and the newer values; nothing is overwritten.
- **Given** an item with stock movements and the organization's lock on moved items on (FR-13), **when** someone
  turns off "stock item" or changes its stock unit, **then** it is refused with the number of movements that block it;
  with the lock off (the default) the change is saved after a warning naming those movements.
- **Given** `4006381333932` typed as EAN-13, **then** it is refused for a wrong check digit; an existing barcode on a
  second item is refused as taken.
- **Given** attributes that would produce 3,000 combinations, **when** **Generate all** is chosen, **then** it is
  refused above 1,000 and the manager is asked to narrow the values.
- **Given** a background generation where 4 of 200 codes collide, **then** 196 variants are created and the result
  names the 4 refused codes and why.
- **Given** a bundle containing itself through another bundle, or a merge of items whose stock units are of different
  categories, **then** it is refused with the reason and nothing changes.
- **Given** a bulk edit interrupted by a restart, **then** the resumed job applies no row twice; an id of another
  organization or tenant answers `404` on every route.

## 3. Functional Requirements

### 3.1 Access, gates and screens

- **FR-1** The system MUST check `FEATURE_CATALOG` on every catalogue plugin route and catalogue menu entry (`404`
  and hidden when off); the existing `/products` routes and Inventory pages keep their gate
  (`FEATURE_ORGANIZATION_INVENTORY`). The release switches `FEATURE_CATALOG` on for every tenant that holds catalogue
  plugin data (publications, collections, relations, variant media), so no tenant loses a route it uses today.
- **FR-2** The system MUST answer `404` on every route this spec adds, and hide its screens, unless both
  `FEATURE_CATALOG` and `FEATURE_ITEM_MASTER` are on; while the latter is off nothing existing changes.
- **FR-3** A user with `PRODUCTS_VIEW` can read every catalogue record; `PRODUCTS_EDIT` changes them,
  `PRODUCTS_DELETE` deletes, `PRODUCTS_MERGE` changes the code of an item with transactions and is needed, beside the
  platform's merge permission, to merge items; a bulk edit needs the platform's bulk-change permission and
  `PRODUCTS_EDIT`; `UNITS_EDIT` changes units and conversions, `CATALOG_SETTINGS_EDIT` changes item settings and
  defaults; any other caller receives `403`. The existing `/products`, `/product-variants` and Inventory routes keep
  their current permissions and the holders they have today.
- **FR-4** A user with `PRODUCTS_VIEW` can open screens for what the back end already does: publication of items and
  variants per sales channel, collections (manual, rule-based, mixed; a tree) with ordered members and channels,
  item relations, variant media and variant tags.

### 3.2 Item master

- **FR-5** The system MUST keep per item: code, name and description per language, item group, kinds, stock, sales
  and purchase units, brand, images, status and enabled flag, end-of-life date, weight with unit, warranty period,
  shelf life in days, commodity code, country of origin, material, notes and tags.
- **FR-6** When the organization setting "unique item codes" is on (default off), the system MUST keep item codes
  unique per organization among live items, listing existing duplicates for review without changing them; with it off
  codes may repeat as today. When the setting "codes from a series" is on, the system fills a blank code from the
  organization's item code series.
- **FR-7** When the organization setting "name from code" is on (default off), the system MUST fill a blank name from
  the code; when the setting "clean descriptions" is on (default off), it MUST sanitise rich descriptions (scripts,
  event handlers, embedded frames removed) before storing them. With both off, names and descriptions are stored as
  sent, as today. The system keeps a plain-text summary of each description for search and receipts.
- **FR-8** The system MUST leave items past their end-of-life date, archived or disabled out of the default list of
  the item search and code lookup this feature adds (used by the pickers of new documents) and answer their
  availability check with the reason; a picker's "include inactive" choice still lists and accepts them, existing
  lines and reads by id are unaffected, and the existing product lists and pickers answer as today.
- **FR-9** When the organization setting "protect referenced items" is on (default off), a user with
  `PRODUCTS_DELETE` can delete an item only while no document line, stock movement or price refers to it; otherwise
  the system refuses with the count of references and offers archiving. With the setting off, deleting works as today
  (with the current permission) after a confirmation that names the references and offers archiving instead.
- **FR-10** The system MUST record who changed an item's code, kinds, units, conversions, barcodes or bundle
  components, when, and the values before and after, in the item's history.

### 3.3 Item kinds

- **FR-11** A user with `PRODUCTS_EDIT` can mark an item stock item, sold, purchased, service, fixed asset,
  customer-provided, subcontracted, used in manufacturing, delivered by the supplier, allows alternatives,
  commission eligible, in any combination; the existing subscription, rentable, chargeable and equipment marks stay.
- **FR-12** The system MUST enforce these rules on save and answer `400` naming the rule:

| Kind | Rule |
|---|---|
| Fixed asset | not a stock item; needs an asset category once `fixed-assets` is on |
| Customer-provided | not purchased; valued at zero by valuation |
| Service | not a stock item |
| Sales bundle parent | not a stock item; at least one component (FR-44) |
| Assembled kit | a stock item; at least one component (FR-46) |
| Template with variants | not on a document line where the organization keeps templates off documents; stock only on its variants (FR-31) |

- **FR-13** When the organization setting "lock moved items" is on (default off), the system MUST refuse turning
  "stock item" off, or changing the stock unit, while the item's variants have stock movements, naming their number;
  with it off the change is saved after a warning naming those movements, as today; other kinds stay editable.
- **FR-14** A user with `CATALOG_SETTINGS_EDIT` can set which kinds a new item gets by default in the organization.

### 3.4 Item groups, brands and defaults

- **FR-15** A user with `PRODUCTS_EDIT` can maintain item groups as a tree of any depth (move with children, image,
  translations, order); an item belongs to one group.
- **FR-16** A user with `PRODUCTS_EDIT` can maintain brands (name and description per language, logo, website); an
  item has at most one brand, and brands filter pricing rules, reports and item search.
- **FR-17** A user with `CATALOG_SETTINGS_EDIT` can set defaults on a brand, a group or the organization, and a user
  with `PRODUCTS_EDIT` on the item itself: stock location (brand, group and organization), supplier, sales and
  purchase unit, tax category, minimum order quantity, lead time. An item's own supplier is its preferred supplier
  term and its supplier lead time comes first from that term (`procurement`); the default selling and buying price
  lists are those of the list chain of `pricing-and-promotions` and show on the item read-only.
- **FR-18** The system MUST resolve each default in the order item, brand, nearest group then its ancestors,
  organization, at the moment it is read, so a group default changed later applies to every item without its own.
- **FR-19** The system MUST answer with each resolved default where it comes from (item, brand, named group,
  organization), on the form and through the API.

### 3.5 Units and conversions

- **FR-20** A user with `UNITS_EDIT` can maintain units (code, name per language, symbol, international common
  code, category, decimal places where zero means whole numbers, active flag); seeded system units cannot be deleted.
- **FR-21** The system MUST convert exactly between units of one category through their factors to the category's
  reference unit, and refuse a conversion across categories unless the item defines one.
- **FR-22** A user with `PRODUCTS_EDIT` can define item-specific conversions (a case of 12 pieces, a bag of 25 kg)
  that override the category factor for that item or variant; the stock unit has the factor one.
- **FR-23** The system MUST refuse a sales or purchase unit without a conversion to the stock unit, and a fractional
  quantity in a whole-number unit in the conversion check documents call.
- **FR-24** The system MUST refuse a disabled unit on new item settings and new document lines; lines that already
  carry it keep it.
- **FR-25** A user with `CATALOG_SETTINGS_EDIT` can allow, per document family (selling, buying, stock), a typed
  stock-unit quantity on lines (default off); the conversion check then accepts it and returns the implied factor.

### 3.6 Barcodes and lookup

- **FR-26** A user with `PRODUCTS_EDIT` can give a variant several barcodes, each with a type (EAN-13, EAN-8, UPC-A,
  GTIN-14, ISBN, ISSN, Code 128, Code 39, QR, internal) and an optional unit; one barcode is primary.
- **FR-27** The system MUST keep barcodes unique per organization among live rows and validate the check digit of
  every type that has one, answering `400` with the reason. A barcode written through the existing variant forms and
  routes is accepted as today: it is stored with type internal (no check digit), and one already taken stays on the
  variant and is listed for review instead of being refused.
- **FR-28** The system MUST resolve a scanned or typed code to a variant, a unit and a quantity, matching in order
  barcode, internal reference, item code (and old codes), manufacturer part, supplier code, the document customer's
  item code; where several items match at the first step that finds any (codes and old codes need not be unique while
  the organization's unique-codes setting is off), it returns them all for the user to choose and picks none itself.
- **FR-29** A user with `PRODUCTS_VIEW` can print barcode labels for chosen items and quantities with a print template
  of the item label type.

### 3.7 Attributes and variants

- **FR-30** A user with `PRODUCTS_EDIT` can maintain organization attributes: name per language and kind (list of
  values with abbreviation, order and translations; numeric range with minimum, maximum and step; free text).
- **FR-31** When the organization setting "templates off documents" is on (default off), the system MUST treat an
  item with variants as a template: it is not put on a document line (pickers ask for a variant) and holds no stock of
  its own. With it off, an item with variants stays usable on document lines as today, and pickers also offer its
  variants.
- **FR-32** A user with `PRODUCTS_EDIT` can apply attributes to a template and generate one variant or all chosen
  combinations after a preview of their count and codes (template code plus value abbreviations and a separator).
- **FR-33** The system MUST refuse more than 1,000 combinations, run more than 50 in the background with progress,
  and answer each row as created or refused with its reason.
- **FR-34** The system MUST refuse a variant value that is not allowed or lies outside the attribute's range or step.
- **FR-35** The system MUST carry a renamed attribute value or abbreviation into the names of its variants, and into
  their codes when the setting allows it, in the background, keeping the old values in their history.
- **FR-36** A user with `PRODUCTS_EDIT` can base a template's variants on manufacturer and part number instead of
  attributes, one variant per part.
- **FR-37** A user with `CATALOG_SETTINGS_EDIT` can choose which fields variants inherit (none by default); the
  system MUST keep them in sync with the template, and a field edited on a variant stops inheriting, is marked "local"
  and can be reset. When a field is chosen, each existing variant whose value differs from its template is marked
  "local" for that field, so no existing variant value is overwritten.
- **FR-38** Existing option groups MUST keep working; a user can link one to an attribute, after which its options
  follow the attribute's values.

### 3.8 Alternatives, relations, manufacturers and codes

- **FR-39** A user with `PRODUCTS_EDIT` can declare an alternative of an item, one-way or both ways, with a ratio and
  a preference order; the system offers alternatives only for items that allow them, and documents keep the
  original item on the line.
- **FR-40** The existing relations (related, upsell, cross-sell, accessory, spare part) MUST keep working and are
  listed with the alternatives.
- **FR-41** A user with `PRODUCTS_EDIT` can maintain manufacturers (short and full name, website, country, logo) and
  per variant manufacturer part numbers with one default, shown on documents and searchable.
- **FR-42** The system MUST show on the item the supplier codes, names, pack sizes and lead times of the supplier
  terms of `procurement`, read-only, with a link to edit them there.
- **FR-43** A user with `PRODUCTS_EDIT` can give an item or variant a code and description for one customer or
  customer group; that customer's documents show and print it, and the lookup accepts it.

### 3.9 Bundles and kits

- **FR-44** A user with `PRODUCTS_EDIT` can define a sales bundle: a parent with components (variant, quantity, unit,
  optional price share, description) in named versions, exactly one active.
- **FR-45** The system MUST give selling documents the active version's components, so reservation and delivery work
  on component lines while the parent line carries the price.
- **FR-46** A user with `PRODUCTS_EDIT` can define an assembled kit: a stock item with components that stock
  movements consume when a kit is assembled or taken apart.
- **FR-47** The system MUST answer a bundle's or kit's availability per stock location as the whole number of sets
  its components' available stock allows.
- **FR-48** The system MUST refuse a bundle that contains itself directly or indirectly, nesting deeper than five
  levels, an inactive component, and a component unit without conversion.
- **FR-49** The system MUST give buying documents a bought bundle's components as plain lines.

### 3.10 Commercial and buying attributes

- **FR-50** A user with `PRODUCTS_EDIT` can set per item maximum discount, over-delivery and over-billing allowance,
  deferred revenue or expense months, commission eligibility and withholding category; `pricing-and-promotions`,
  `business-document-engine`, `budgets-and-revenue-schedules`, `sales-order-management` and `tax-engine` enforce them.
- **FR-51** A user with `PRODUCTS_EDIT` can set minimum order quantity, order multiple and purchase lead time with
  buffer days; the item shows its last purchase price as `procurement` reports it.
- **FR-52** A user with `PRODUCTS_EDIT` can set the tax category of an item or variant, defaulting from its group;
  the rates of a category belong to `tax-engine`.
- **FR-53** The system MUST write a selling price typed on the new-item form as each new variant's default price
  through `pricing-and-promotions`, converted into the default list's currency at the current rate; while
  `FEATURE_PRICING` is off the item forms keep writing the variant's retail price as today, and one form never writes
  both.
- **FR-54** A user with `STOCK_EDIT` can enter an opening quantity per stock location when creating a stock item,
  recorded as a receipt movement through the stock ledger; without a location it is refused.

### 3.11 Translations and media

- **FR-55** A user with `PRODUCTS_EDIT` can translate names and descriptions of items, groups, brands, attributes,
  values and units into the organization's languages; a missing translation falls back to the default language.
- **FR-56** A user with `PRODUCTS_EDIT` can attach images, videos, documents and 3D model files to an item or variant
  through the platform's file storage, order them and give each a text alternative per language; a variant
  without media shows its item's.
- **FR-57** (advanced) A user with `PRODUCTS_EDIT` can request AI drafts of missing translations of chosen
  items into a language; drafts are marked "machine draft", stay off documents and customer pages until a person
  approves them, and are rejected in one click.

### 3.12 Search, item page and data quality

- **FR-58** The system MUST rank item search over code, name in every language, barcode, internal reference,
  manufacturer part, supplier and customer codes and old codes, tolerating one wrong character in terms of five or
  more characters.
- **FR-59** The item page MUST show stock per location from the stock ledger, prices per price list from
  `pricing-and-promotions`, and a connections panel counting the documents each loaded plugin reports for it.
- **FR-60** (advanced) The system MUST warn on save and import when a new item shares a manufacturer part or
  supplier code with, or has a name similar above the organization's threshold (default 0.85) to, a live item, with
  candidates and scores; the user may continue with a recorded reason.
- **FR-61** (advanced) The platform's nightly duplicate scan (`data-import-export`) MUST include each
  organization's items, with score and evidence from the item rules; a user with `PRODUCTS_MERGE` can merge or
  dismiss a pair, and a dismissed pair is not listed again.
- **FR-62** (advanced) The system MUST score completeness per item, channel and language from the fields the
  organization requires (image, translation, barcode, weight, price, description) and list the gaps.

### 3.13 Bulk edit, code change and merge

- **FR-63** (advanced) A user with the platform's bulk-change permission and `PRODUCTS_EDIT` can select up to
  5,000 items, set group, brand, kinds, units, defaults, status, tags or attributes, preview each row's before and
  after values and refusals, and apply in the background with a result per row (a bulk change of
  `data-import-export` over items).
- **FR-64** (advanced) The user who ran a bulk edit can undo it within 24 hours; rows changed again since are
  skipped and reported.
- **FR-65** A user can change the code of an item with transactions with the permission that edits items today, and
  only with `PRODUCTS_MERGE` where the organization setting "lock codes of traded items" is on (default off);
  documents keep the item and the old code stays searchable.
- **FR-66** A user with `PRODUCTS_MERGE` can merge one item into another when their stock units share a category,
  kinds agree, no lot or serial is shared and no bundle version is duplicated; the system MUST move the catalogue's
  references to the target, ask the stock ledger to move balances, and archive the source with a "merged into" link
  (a merge of `data-import-export`, with these conditions as the item's merge guard).

### 3.14 Reports

- **FR-67** The system MUST provide these reports as report definitions filtered by item group, brand, stock location
  and price list, exportable as CSV and spreadsheet files:

| Report | Answers |
|---|---|
| Item prices and stock | each item's price per chosen price list beside its stock per location |
| Item price comparison | last purchase price, valuation rate, selling and buying list prices and structure cost side by side (blank when the owning plugin is off) |
| Variant details | a template's variants with their attribute values and stock |
| Item price list rates | one row per item and price list with rate, unit, currency and validity |
| Catalogue completeness (advanced) | score and missing fields per item, channel and language |
| Duplicate candidates (advanced) | open pairs with score and evidence |

### 3.15 Real time, events and agents

- **FR-68** (advanced) The system MUST push item, variant, barcode, bundle and status changes to open item
  lists, item pages and registers through the real-time channel within 2 seconds of the commit.
- **FR-69** The system MUST publish `catalog.item.created`, `.updated`, `.archived`, `.merged` and
  `catalog.bundle.changed` through the event outbox with ids only, for automations, webhooks and other plugins.
- **FR-70** (advanced) The MCP server MUST offer tools to search items, read an item with resolved defaults,
  create and update items, generate variants, run bulk edits, list duplicates and draft translations; writing tools
  accept `preview: true`, return the effects without saving, and run with the caller's permissions.

## 4. Non-Functional Requirements

- **Performance**: item list P95 < 300 ms at 1 million items per tenant; search P95 < 200 ms at 100,000 items per
  organization; code and barcode lookup P95 < 50 ms; defaults for 100 lines < 100 ms; generating 1,000 variants
  < 60 s; bulk edit of 5,000 rows < 2 min.
- **Reliability**: generations, bulk edits and merges resume and apply each row once; the duplicate scan catches up.
- **Security & privacy**: tenant and organization scoped; descriptions sanitised; uploads checked for type and size;
  AI drafts send only the chosen texts to the organization's configured AI provider, and nothing without one.
- **Observability**: item history (FR-10); job results kept 30 days; lookup and scan latency metrics.
- **Accessibility and localization**: keyboard operable, screen-reader labelled; keys in every shipped locale.
- **Compatibility**: PostgreSQL, MySQL, SQLite; both ORMs; additive migrations; cloud and self-hosted; OpenAPI
  additive, SDKs regenerated.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| Item | What is sold, bought, stocked or made; the existing product |
| Variant | A sellable, stockable form of an item; the existing product variant |
| Item kind | A mark deciding which documents and engines may use an item |
| Item group | A node of the existing category tree; classifies items and carries defaults |
| Brand | A trade name items are sold under |
| Item default | A value set on an item, brand, group or organization and resolved live |
| Unit, item conversion | A measure of a family (existing); an item-specific factor from one of its units to its stock unit |
| Barcode | A scannable code of a variant with a type and an optional unit |
| Attribute, attribute value | An organization-wide property variants differ by, and its allowed values |
| Alternative | An item that may replace another when stock is short |
| Manufacturer part, customer code | The maker's code for an item; a customer's own code for it |
| Bundle, kit | Components sold as one; components assembled into a stocked item |
| Duplicate candidate, bulk edit | A pair of items that look alike; a previewed change to many items with undo (platform records of `data-import-export`) |

## 6. Out of Scope

- Prices, price lists limited to countries, pricing rules, bundle prices → `pricing-and-promotions`.
- Stock locations and quantities, reorder levels and their template-to-variant fallback, kit assembly documents →
  `warehouse-and-stock-movements`.
- Standard cost, valuation methods, the valuation of an opening quantity → `stock-ledger-and-valuation`.
- Lots and serials → `serials-and-batches`; inspection settings and sample retention → `quality-management`.
- Ledger accounts and cost centres per item or group → `general-ledger`; tax rates → `tax-engine`; asset creation
  from fixed-asset items → `fixed-assets`.
- Supplier codes, supplier lead times and prices → `procurement`; manufacturing times →
  `manufacturing-bom-and-routing`; scan fields on documents → each document's spec.
- The generic bulk-update, duplicate scan and merge framework → `data-import-export`; label layout design →
  `print-and-pdf-designer`; the search index and its typo tolerance → the `search` plugin.

## 7. Acceptance Criteria

- [ ] **AC-1** An item with group, brand, kinds, units and a case conversion shows inherited defaults with their source;
      changing the group default changes the item's resolved value (FR-18, FR-19, FR-22).
- [ ] **AC-2** Each kind rule of FR-12 refuses an invalid item with its reason; a stock-unit change after a movement is refused with the lock of FR-13 on and warned with it off.
- [ ] **AC-3** A GTIN-14 case barcode scans to the variant, the case unit and 12 pieces; a wrong check digit is refused (FR-26–FR-28).
- [ ] **AC-4** Generating all combinations of two attributes previews and creates the variants; 1,001 are refused; a partial
      failure names each refused code (FR-32, FR-33).
- [ ] **AC-5** A sales bundle expands into component lines and reports its available sets; a cycle is refused (FR-44, FR-47).
- [ ] **AC-6** A customer item code is found in that customer's picker and printed on their documents (FR-43).
- [ ] **AC-7** A code change keeps documents linked and the old code searchable; a merge with incompatible units is refused (FR-65, FR-66).
- [ ] **AC-8** Bulk edit (advanced): preview, apply with per-row results, undo within 24 hours (FR-63, FR-64).
- [ ] **AC-9** Duplicates (advanced): a near-duplicate warns on save; the duplicate scan lists it; merge and dismiss work (FR-60, FR-61).
- [ ] **AC-10** Agents (advanced): every MCP writing tool with `preview: true` saves nothing (FR-70).
- [ ] **AC-11** Translations (advanced): AI drafts stay off documents until approved (FR-57).
- [ ] **AC-12** Real time (advanced): an archived item leaves an open list within 2 seconds (FR-68).
- [ ] **AC-13** The six reports of FR-67 run with their filters and export.
- [ ] **AC-14** Catalogue routes answer `404` with `FEATURE_CATALOG` off and new routes with `FEATURE_ITEM_MASTER` off;
      nothing changes for a tenant while it is off (FR-1, FR-2).
- [ ] **AC-15** Works on PostgreSQL, MySQL and SQLite with both ORMs; every functional requirement has a passing test (§4).
- [ ] **AC-16** With `FEATURE_ITEM_MASTER` on and the item settings at their defaults, an existing item is saved,
      deleted, picked (in the item search of this feature through "include inactive" when inactive), given a new code
      and given a barcode through the existing forms exactly as before, a blank name and a description with a script
      are stored as sent, and no existing variant value is overwritten; a tenant that holds catalogue data keeps its
      catalogue routes after the release (FR-2, FR-6, FR-7, FR-8, FR-10, FR-13).
- [ ] **AC-17** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today, apart from the feature codes that guard their routes, which are switched on for every tenant that holds their data (FR-1).

## 8. Open Questions

- Reading `FEATURE_CATALOG` on routes that answered for every tenant: default applied, the release switches the code
  on for every tenant holding catalogue plugin data (FR-1).
- Converting existing option groups into attributes; default: no automatic conversion, a "link to attribute" action.
- Items shared by organizations of a tenant; default: per organization, sharing through `organization-setup`.
- Barcode uniqueness per organization or per tenant; default: per organization.

## 9. Constitution Gates

- [x] I Plugin-first — new tables in the existing `catalog` plugin, columns on core item tables through the kernel
      migration set the catalogue already uses, screens in a new `catalog-ui` plugin and the Inventory pages.
- [x] II Tenant/organization scoping — every new record is tenant and organization scoped; lookups never cross.
- [x] III Both ORMs, additive migrations — new tables and nullable columns only, for PostgreSQL, MySQL and SQLite.
- [x] IV Default-off flag; nothing removed — `FEATURE_ITEM_MASTER` off; option groups, relations, routes kept.
- [x] V Contracts and API first — every behaviour is an endpoint with contracts in `@gauzy/contracts` before UI.
- [x] VI Permissions, privacy, security — permission per action; sanitised text; AI drafts send only chosen texts.
- [x] VII Real-time through the event bus — outbox events and real-time pushes (FR-68, FR-69).
- [x] VIII i18n and accessibility — translation keys in every locale; accessible screens.
- [x] IX Tests accompany the change — each requirement has a test (tasks).
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md) · Uses: `../pricing-and-promotions/`,
  `../warehouse-and-stock-movements/`, `../data-import-export/`, `../report-builder-and-dashboards/`,
  `../print-and-pdf-designer/`, `../realtime-channel/`, `../ai-agents-and-assistants/`, `../procurement/` (supplier
  terms), `../manufacturing-bom-and-routing/` (kits and structures); read by `../point-of-sale-and-loyalty/`,
  `../delivery-and-shipping/` (item lookup)
- Code: `packages/core/src/lib/product*`, `packages/core/src/lib/measurement`, `packages/plugins/catalog`,
  `apps/gauzy/src/app/pages/inventory`
