# Task Breakdown: Item catalogue

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `item-catalogue`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind `FEATURE_ITEM_MASTER`: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it. `[n]` at the end of a task is the rollout phase of the plan (§11) it belongs to.
- `C/` = `packages/plugins/catalog/src/lib/`, `CU/` = `packages/plugins/catalog-ui/src/lib/`,
  `INV/` = `apps/gauzy/src/app/pages/inventory/components/`. Every new entity file has its
  `repository/type-orm-<name>.repository.ts` and `repository/mikro-orm-<name>.repository.ts` beside it and every new
  controller its `dto/` folder; Angular components sit in `CU/components/<name>/<name>.component.ts` with their
  `*.component.spec.ts`.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/item-catalogue.model.ts` (enums, entity interfaces, resolved
  default, lookup, availability, generation, duplicate evidence, completeness shapes; bulk change, duplicate candidate
  and merge shapes are those of `data-exchange.model.ts`) + additive fields on `IProduct`, `IProductVariantSetting`,
  `IUnit`; export from `index.ts`. Files: `packages/contracts/src/lib/product.model.ts` (`IProduct`,
  `IProductVariantSetting`), `IUnit` declared in `item-catalogue.model.ts` (contracts has no unit interface today),
  `packages/contracts/src/index.ts`. Test: `packages/contracts/src/lib/item-catalogue.model.spec.ts` (type
  tests). [1]
- [ ] **T2**. Feature and permissions: `FEATURE_ITEM_MASTER` in `catalog.features.ts` (off, depends on
  `FEATURE_CATALOG`); `PRODUCTS_MERGE`, `CATALOG_SETTINGS_EDIT` as permission contributions with `defaultFor` in
  `catalog.permissions.ts` (existing tenants through the permission reload; no seed migration). Files:
  `C/catalog.features.ts`, `C/catalog.permissions.ts`. Test: `C/catalog.permissions.spec.ts` (keys, `defaultFor`,
  `FEATURE_ITEM_MASTER` off by default and depending on `FEATURE_CATALOG`; `/products` keeps its permissions). [1] Migration timestamps: `1791000022100` to `1791000022199` (`packages/plugins/catalog`); `1791000022900` to `1791000022999` (`packages/core`).
- [ ] **T3**. Kernel migration `packages/core/src/lib/database/migrations/1791000022900-ExtendItemMasterColumns.ts`
  (product, variant setting, variant, option group, option, unit columns; `unit_conversion` table) for PostgreSQL,
  MySQL, SQLite; entity columns on `Product`, `ProductVariantSetting`, `ProductVariant`, `ProductOptionGroup`,
  `ProductOption`, `Unit`; new `UnitConversion` entity + both repositories. Files:
  `packages/core/src/lib/product/product.entity.ts`, `packages/core/src/lib/product-setting/product-setting.entity.ts`,
  `packages/core/src/lib/product-variant/product-variant.entity.ts`,
  `packages/core/src/lib/product-option/product-option-group.entity.ts`,
  `packages/core/src/lib/product-option/product-option.entity.ts`, `packages/core/src/lib/measurement/unit.entity.ts`,
  `packages/core/src/lib/measurement/unit-conversion.entity.ts`. Test:
  `packages/core/src/lib/database/extend-item-master-columns-migration.spec.ts` (SQLite; up twice is a no-op). [1]
- [ ] **T4**. Catalog entities `packages/plugins/catalog/src/lib/{brand,manufacturer,item-barcode,
  item-manufacturer-part,item-attribute,item-attribute-value,item-variant-attribute,item-customer-code,
  item-code-alias,item-bundle,item-bundle-component,item-default}/` with MultiORM decorators and repository pairs;
  registered in `catalog.plugin.ts`. Files: one `<folder>/<folder>.entity.ts` per folder above (with
  `brand/brand-translation.entity.ts`, `item-attribute/item-attribute-translation.entity.ts`,
  `item-attribute-value/item-attribute-value-translation.entity.ts`), `C/catalog.plugin.ts`. Test:
  `C/item-master.entities.spec.ts` (entity metadata for both ORMs). [2]
- [ ] **T5** (parallel). Catalog entities `item-completeness`, `item-translation-draft` (duplicate candidates, bulk
  change rows and merges are `data-import-export` records; long runs are core operations). Files:
  `C/item-completeness/item-completeness.entity.ts`, `C/item-translation-draft/item-translation-draft.entity.ts`. Test:
  `C/item-master.entities.spec.ts` (entity metadata for both ORMs). [3]
- [ ] **T6**. Migrations `1791000022110-CreateItemMasterTables`, `1791000022120-ExtendProductRelation`,
  `1791000022130-BackfillItemBarcodes` in `packages/plugins/catalog/src/lib/database/migrations/` with the shared core
  migration helpers (`@gauzy/core`). Files: `C/database/migrations/1791000022110-CreateItemMasterTables.ts`,
  `C/database/migrations/1791000022120-ExtendProductRelation.ts`, `C/database/migrations/1791000022130-BackfillItemBarcodes.ts`.
  Test: `C/database/item-master-migrations.spec.ts` (SQLite run; a barcode shared by two variants lands in the drift
  list). [2]
- [ ] **T7**. Plugin settings `packages/plugins/catalog/src/lib/catalog.settings.ts` (code series, separator,
  inherited fields (none by default), duplicate threshold, required fields, stock-quantity override per family,
  default kinds, the organization-level item defaults of plan §3, and the stricter rules `uniqueCodes`,
  `protectReferencedItems`, `lockMovedItems`, `templatesOffDocuments`, `lockTradedCodes`, `nameFromCode`,
  `cleanDescriptions`, all default off). Test:
  `C/catalog.settings.spec.ts` (defaults); with the defaults, existing `packages/core/src/lib/product/product.controller.spec.ts`
  and `product.resolver.spec.ts` pass unchanged. [2]

## Phase 2 — Services, endpoints, events

- [ ] **T8**. Feature guard on the nine existing catalogue controllers (`@FeatureFlag(FEATURE_CATALOG)` +
  `FeatureFlagGuard`) and data step `1791000022140-EnableCatalogForActiveTenants` (switches the code on for tenants
  holding catalogue rows). Files: the nine controllers `C/collection/collection.controller.ts`,
  `C/collection-channel/collection-channel.controller.ts`, `C/collection-product/collection-product.controller.ts`,
  `C/collection-variant/collection-variant.controller.ts`, `C/product-channel/product-channel.controller.ts`,
  `C/product-relation/product-relation.controller.ts`, `C/product-variant-channel/product-variant-channel.controller.ts`,
  `C/product-variant-media/product-variant-media.controller.ts`, `C/tag-product-variant/tag-product-variant.controller.ts`;
  `C/database/migrations/1791000022140-EnableCatalogForActiveTenants.ts`. Test: `C/catalog-feature-gate.spec.ts` (`404`
  when off; a tenant with catalogue rows keeps access). [1]
- [ ] **T9**. Ports `CATALOG_PRICE_WRITER`, `CATALOG_STOCK_AVAILABILITY` (`StockAvailabilityService`),
  `CATALOG_STOCK_LEDGER` (opening receipts and merge transfers), `CATALOG_SUPPLIER_TERMS`, `CATALOG_ASSISTANT` in
  `catalog.references.ts`; bindings in `apps/api/src/plugin-composition.ts`. Files: `C/catalog.references.ts`,
  `apps/api/src/plugin-composition.ts`. Test: `C/catalog.references.spec.ts` (an unbound port answers with a notice). [2]
- [ ] **T10**. Item kind rules `catalog/src/lib/item-kind/item-kind.rules.ts` (pure) + hook into product and
  variant-setting writes; stock-unit lock using the stock ledger port when `lockMovedItems` is on, a warning otherwise.
  Files: `C/item-kind/item-kind.rules.ts`, `C/item-kind/item-kind.hook.ts`. Test: `C/item-kind/item-kind.rules.spec.ts`
  (each rule of FR-11..FR-14; default kinds of a new item). [2]
- [ ] **T11**. Brands and manufacturers services and controllers with translations, logos. Files:
  `C/brand/brand.service.ts`, `C/brand/brand.controller.ts`, `C/manufacturer/manufacturer.service.ts`,
  `C/manufacturer/manufacturer.controller.ts`. Test: `C/brand/brand.service.spec.ts`,
  `C/manufacturer/manufacturer.service.spec.ts` (translation fallback; logo kept; one brand per item). [2]
- [ ] **T12**. Item defaults: `item-default.service.ts` (brand and group rows; item values from the item's columns,
  the preferred supplier term and its lead time through `CATALOG_SUPPLIER_TERMS`, organization values from the
  settings; resolve item → brand → groups → organization with source per the owner table of plan §3),
  `/item-defaults`, `/item-defaults/resolve`. Files: `C/item-default/item-default.service.ts`,
  `C/item-default/item-default.controller.ts`. Test: `C/item-default/item-default.service.spec.ts` (order and source per
  field; live resolution after a group change). [2]
- [ ] **T13**. Units: `isActive`, `commonCode` on `/units`; `/unit-conversions`; `UnitService.convert` with item
  conversions, whole-number checks, disabled units, stock-quantity override. Files:
  `packages/core/src/lib/measurement/unit.service.ts`, `packages/core/src/lib/measurement/unit.controller.ts`,
  `packages/core/src/lib/measurement/unit-conversion.service.ts`, `packages/core/src/lib/measurement/unit-conversion.controller.ts`.
  Test: `packages/core/src/lib/measurement/unit-conversion.service.spec.ts` (FR-20..FR-25; a second organization-wide,
  item-level or variant-level conversion of the same unit refused through `scopeKey` on each dialect; a user with
  `PRODUCTS_EDIT` and without `UNITS_EDIT` defines a case conversion for an item and is refused an organization-wide
  one). [2]
- [ ] **T14**. Barcodes: service with check-digit validators per type, the only writer of `product_variant.barcode`
  (the primary's copy) while `FEATURE_ITEM_MASTER` is on, variant DTO `barcode` writes routed to it as type
  `INTERNAL` and never refused (a taken value joins the drift list), nightly drift list, `/item-barcodes`. Files:
  `C/item-barcode/item-barcode.service.ts`, `C/item-barcode/item-barcode.controller.ts`,
  `C/item-barcode/barcode-check-digit.ts`, `C/item-barcode/variant-barcode.hook.ts`. Test:
  `C/item-barcode/barcode-check-digit.spec.ts` (each type); `C/item-barcode/item-barcode.service.spec.ts` (uniqueness;
  routing of variant DTO writes; drift list). [2]
- [ ] **T15**. Lookup `/item-lookup` (barcode, reference, code, part, supplier code through the port, customer
  code, alias) with match order. Files: `C/item-lookup/item-lookup.service.ts`, `C/item-lookup/item-lookup.controller.ts`.
  Test: `C/item-lookup/item-lookup.service.spec.ts` (match order; two items sharing a code or an old code both returned
  as candidates; a customer code and a group code each unique for their owner); `C/item-lookup/item-lookup.db.spec.ts` (latency on
  100k rows, SQLite and PostgreSQL). [2]
- [ ] **T16**. Attributes and values (`/item-attributes`), variant values of range and text attributes (list values
  are the variant's options through `product_option.attributeValueId`), option-group linking (FR-38). Files:
  `C/item-attribute/item-attribute.service.ts`, `C/item-attribute/item-attribute.controller.ts`,
  `C/item-variant-attribute/item-variant-attribute.service.ts`, `C/item-attribute/option-group-link.service.ts`. Test:
  `C/item-attribute/item-attribute.service.spec.ts` (value outside range or step refused; a linked option group follows
  the values). [2]
- [ ] **T17**. Variant generator: preview, code builder, limit 1,000, inline up to 50, core operation
  `CATALOG_VARIANT_GENERATE` above (options and pivot rows for list values); template rule (`hasVariants`) applied to
  pickers only while `templatesOffDocuments` is on;
  `/items/:id/variants/preview|generate`; a template whose basis is manufacturer gets one variant per part. Files:
  `C/variant-generator/variant-generator.service.ts`, `C/variant-generator/variant-code.builder.ts`,
  `C/variant-generator/variant-generator.controller.ts`. Test: `C/variant-generator/variant-generator.service.spec.ts`
  (limit 1,000; inline up to 50; partial failure names refused codes). [2]
- [ ] **T18**. Propagation and inheritance: attribute rename and template field sync as core operation
  `CATALOG_PROPAGATE`, `localFields`, reset to template; choosing an inherited field first marks it local on every
  variant whose value differs from its template. Files: `C/variant-inheritance/variant-inheritance.service.ts`,
  `C/variant-inheritance/catalog-propagate.operation.ts`. Test: `C/variant-inheritance/variant-inheritance.service.spec.ts`
  (renamed value carried into names; no existing variant value overwritten; reset to template). [2]
- [ ] **T19**. Alternatives on `product_relation` (type, both ways, ratio, order) + manufacturer parts + customer
  codes services and controllers; supplier terms read through the port. Files:
  `C/product-relation/product-relation.service.ts`, `C/product-relation/product-relation.controller.ts`,
  `C/item-manufacturer-part/item-manufacturer-part.service.ts`, `C/item-manufacturer-part/item-manufacturer-part.controller.ts`,
  `C/item-customer-code/item-customer-code.service.ts`, `C/item-customer-code/item-customer-code.controller.ts`. Test:
  `C/product-relation/product-relation.service.spec.ts` (both ways, ratio, order; only for items that allow them);
  `C/item-customer-code/item-customer-code.service.spec.ts`. [2]
- [ ] **T20**. Bundles and kits: versions, components, cycle and depth checks, a kit refused on an item with a
  released manufacturing structure (`MANUFACTURING_USAGE`), availability per location through
  `CATALOG_STOCK_AVAILABILITY`, expansion API for selling and buying documents. Files:
  `C/item-bundle/item-bundle.service.ts`, `C/item-bundle/item-bundle.controller.ts`, `C/item-bundle/bundle-structure.rules.ts`,
  `C/item-bundle/bundle-expansion.service.ts`. Test: `C/item-bundle/item-bundle.service.spec.ts` (FR-44..FR-49). [2]
- [ ] **T21**. Commercial and buying attributes on the product DTOs; last purchase price through the port;
  standard selling price written through the price port on create, the Inventory variant price fields writing
  `product_price` while `FEATURE_ITEM_MASTER` and `FEATURE_PRICING` are both on (setting `priceOnList`), and the legacy
  row while either is off unless pricing is on and the variant's `priceOnList` is set (FR-53); opening quantity receipt
  through the ledger port (FR-54). Files: `packages/core/src/lib/product/dto/` (new optional fields),
  `C/item-commercial/item-commercial.service.ts`, `C/item-commercial/opening-stock.service.ts`,
  `INV/edit-inventory-item-variant/variant-form.component.ts`. Test:
  `C/item-commercial/item-commercial.service.spec.ts` (one form never writes both prices; with `FEATURE_PRICING` on and
  `FEATURE_ITEM_MASTER` off the variant form writes the legacy row exactly as today for a variant never priced on the
  list; a variant priced on the list while both were on, edited after `FEATURE_ITEM_MASTER` is switched off, resolves
  to the edited price);
  `C/item-commercial/opening-stock.service.spec.ts` (refused without a location). [2]
- [ ] **T22**. Availability (`StockAvailabilityService` through `CATALOG_STOCK_AVAILABILITY`) and end-of-life check
  `/items/:id/availability`; connections registry
  (`CatalogConnectionProvider` token other plugins register) and `/items/:id/connections`. Files:
  `C/catalog-item/item-availability.service.ts`, `C/catalog-item/item-connections.registry.ts`,
  `C/catalog-item/catalog-item.controller.ts`. Test: `C/catalog-item/item-availability.service.spec.ts` (end-of-life
  answered with the reason); `C/catalog-item/item-connections.registry.spec.ts`. [2]
- [ ] **T23**. Item search `/items/search` as a facade over the `search` plugin: new fields on its `product` and
  `product-variant` definitions (normalised name, old codes, barcodes, parts, supplier and customer codes), the
  definition option "one wrong character in terms of five or more characters" in the search plugin, a database
  provider over the same fields when `FEATURE_SEARCH` is off. Files: `C/item-search/item-search.service.ts`,
  `C/item-search/item-search.controller.ts`, `C/item-search/item-search.db-provider.ts`,
  `packages/plugins/search/src/lib/definitions/product.definition.ts`,
  `packages/plugins/search/src/lib/definitions/product-variant.definition.ts`. Test:
  `C/item-search/item-search.service.spec.ts` (one wrong character tolerated in terms of five or more; old codes found);
  `C/item-search/item-search.db.spec.ts` (P95 on 100,000 items). [2]
- [ ] **T24**. Code change `/items/:id/code` with aliases and history (also the item's `rename` part;
  `PRODUCTS_MERGE` required only while `lockTradedCodes` is on); delete protection of referenced items while
  `protectReferencedItems` is on, a confirmation naming the references otherwise; the item's
  record type parts for `data-import-export` (import creator and match keys, `mergeGuard` with the FR-66 conditions
  and `PRODUCTS_MERGE`) and its merge participants through `registerMergeParticipants` (stock transfer through the
  ledger port, price rows, supplier terms, channel publication, relations, barcodes, aliases, bundle components,
  `catalog.item.merged`), on `data-import-export` T1, T2, T30 and T32. Files: `C/item-code/item-code.service.ts`,
  `C/item-code/item-code.controller.ts`, `C/item-code/item-delete.guard.ts`, `C/data-exchange/item-record-type.parts.ts`,
  `C/data-exchange/item-merge.participants.ts`. Test: `C/data-exchange/item-merge.participants.spec.ts` (each guard and
  participant); `C/item-code/item-code.service.spec.ts` (old code stays searchable; renaming two items that shared code `X`
  keeps an old code `X` for each). [2]
- [ ] **T25**. Outbox events `catalog.item.*`, `catalog.bundle.changed`, `catalog.barcode.changed`;
  `declareStreamedEvents`; activity-log history with before and after values. Files: `C/events/catalog.events.ts`,
  `C/events/catalog-streamed-events.ts`, `C/events/item-history.service.ts`. Test: `C/events/catalog-streamed-events.spec.ts`
  (one outbox event per change; the activity log holds before and after values). [2]
- [ ] **T26**. Operation types `CATALOG_VARIANT_GENERATE`, `CATALOG_PROPAGATE`, `CATALOG_TRANSLATION_DRAFTS`
  registered with the core `OperationRegistry` (queue `catalog-maintenance`, handlers in the API),
  `CatalogSchedulePlugin` (nightly completeness) in `apps/worker/src/plugins.ts`. Files: `C/operations/catalog-operations.ts`,
  `C/catalog-schedule.plugin.ts`, `apps/worker/src/plugins.ts`. Test: `C/operations/catalog-operations.spec.ts` (resume
  without double apply); `apps/worker/src/plugins.spec.ts`. [2]
- [ ] **T27**. Label printing request `/item-labels/print` to the print engine (item label template seeded). Files:
  `C/item-label/item-label.controller.ts`, `C/item-label/item-label.template.ts` (registered through
  `registerPrintTemplates`, `print-and-pdf-designer` T36). Test: `C/item-label/item-label.controller.spec.ts` (a print
  request renders the seeded item label template). [2]
- [ ] **T28**. Report definitions declared through `registerReportDefinitions` (no route): variant details and item
  price list rates [1]; item prices and stock, item price comparison [2]. Files: `C/reports/catalog-report.definitions.ts`.
  Test: `C/reports/catalog-report.definitions.spec.ts` (each definition on fixtures; blank columns when the owning
  plugin is off).
- [ ] **T50**. Item save rules: unique codes per organization among live items while `uniqueCodes` is on
  (existing duplicates listed for review, not changed), a blank code from the item code series (core sequence) while
  that setting is on, a blank name from the code while `nameFromCode` is on, rich descriptions sanitised while
  `cleanDescriptions` is on (both default off: names and descriptions stored as sent, as today), and always the
  plain-text summary and the normalised name. Files: `C/item-master/item-master-write.hook.ts`,
  `C/item-master/item-code.rules.ts`. Test: `C/item-master/item-code.rules.spec.ts` (codes
  repeat with the setting off; with the settings off a blank name and a script are stored as sent; with
  `cleanDescriptions` on a script is removed and the summary kept). [2]
- [ ] **T52**. Item list rules: the default lists of the new routes `/items/search` and
  `/item-lookup` leave out items past end of life, archived or disabled unless `includeInactive=true` ("include
  inactive" in the pickers built on them); the existing `/products` lists answer as today. Files:
  `C/item-search/item-search.service.ts`, `C/item-search/item-search.controller.ts`,
  `C/item-lookup/item-lookup.service.ts`, `C/item-lookup/item-lookup.controller.ts`. Test:
  `C/item-search/item-search.service.spec.ts` (inactive items only with "include inactive");
  `C/item-lookup/item-lookup.service.spec.ts` (an archived item's code found only with `includeInactive=true`). [2]

## Phase 3 — UI surfaces

- [ ] **T29**. Plugin locations `inventory-item-form-sections` and `inventory-item-view-panels` in
  `apps/gauzy/src/app/pages/inventory/components/edit-inventory-item` and `view-inventory-item`. Files:
  `INV/edit-inventory-item/product-form.component.ts`, `INV/view-inventory-item/view-inventory-item.component.ts`.
  Test: `INV/edit-inventory-item/product-form.component.spec.ts` (the location renders contributed sections and
  nothing with the flag off). [1]
- [ ] **T30**. Scaffold `packages/plugins/catalog-ui` (package, project, jest, i18n `en.json`), registration in
  `apps/gauzy/src/plugin-ui.config.ts`, menu Inventory → Catalogue gated by both features and permissions; the
  `FEATURE_CATALOG` link in `commerce-feature-catalogue.ts` pointed at `pages/inventory`. Files:
  `packages/plugins/catalog-ui/` (`package.json`, `project.json`, `jest.config.ts`, `src/i18n/en.json`),
  `CU/catalog-ui.plugin.ts`, `CU/catalog-ui.routes.ts`, `apps/gauzy/src/plugin-ui.config.ts`,
  `packages/core/src/lib/feature/commerce-feature-catalogue.ts`. Test: `CU/catalog-ui.plugin.spec.ts` (shell renders;
  the menu entry is hidden unless both features and the permission are on). [1]
- [ ] **T31**. Pages for existing back end: collections (tree, members, rule preview, channels), publication per
  channel, relations, variant media and tags, units; the existing categories page (`manage-product-categories`)
  gains tree moves, image, translations and order while `FEATURE_ITEM_MASTER` is on; component specs, incl. the
  categories page unchanged with the flag off. Files: `CU/components/collections/`, `CU/components/publication/`,
  `CU/components/relations/`, `CU/components/variant-media/`, `CU/components/units/`,
  `INV/manage-product-categories/product-categories.component.ts`. Test: the component specs in those folders;
  `INV/manage-product-categories/product-categories.component.spec.ts` (unchanged with the flag off). [1]
- [ ] **T32**. Inventory sections for API-only variant columns (barcode, weight with unit, customs, units) and the item
  master fields of FR-5 (end of life, warranty, shelf life, commodity code, origin, material). Files:
  `CU/components/item-master-section/`, `CU/components/variant-columns-section/`. Test: their component specs (rendering;
  the sections are absent with the flag off). [1]
- [ ] **T33**. Brands, manufacturers, attributes pages; Kinds, Defaults (with source), Units and conversions,
  Barcodes, Attributes and variants (generator with preview) sections. Files: `CU/components/brands/`,
  `CU/components/manufacturers/`, `CU/components/attributes/`, `CU/components/kinds-section/`,
  `CU/components/defaults-section/`, `CU/components/unit-conversions-section/`, `CU/components/barcodes-section/`,
  `CU/components/variants-section/`. Test: their component specs (rendering; the variant generator preview creates
  nothing). [2]
- [ ] **T34** (parallel). Alternatives and relations, Manufacturers and codes, Bundle or kit, Buying and commercial,
  Media, Translations, History sections. Files: `CU/components/alternatives-section/`,
  `CU/components/manufacturer-codes-section/`, `CU/components/bundle-section/`, `CU/components/commercial-section/`,
  `CU/components/media-section/`, `CU/components/translations-section/`, `CU/components/history-section/`. Test: their
  component specs (rendering). [2]
- [ ] **T35**. Settings page (organization-level defaults included); report entries open the report builder. Files:
  `CU/components/catalog-settings/`, `CU/components/catalog-reports/`. Test: their component specs (rendering; a report
  entry opens the report builder). [2]
- [ ] **T36**. i18n keys of `catalog-ui` and the new Inventory strings in every locale under
  `packages/ui-core/i18n/`; accessibility pass (keyboard, labels) with a check in the component specs. Files:
  `packages/ui-core/i18n/assets/i18n/*.json`, `packages/plugins/catalog-ui/src/i18n/en.json`. Test:
  `CU/catalog-ui.i18n.spec.ts` (every key in every locale). [2]
- [ ] **T51**. Item page panels in `inventory-item-view-panels`: stock per location (`/items/:id/availability`), prices
  per price list read from `pricing-and-promotions` (absent without it) and the connections panel
  (`/items/:id/connections`). Files: `CU/components/item-stock-panel/`, `CU/components/item-prices-panel/`,
  `CU/components/item-connections-panel/`. Test: their component specs (each panel renders its counts; the prices panel
  is absent without pricing). [2]

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T37**. MCP read tools: `get_product` in `products.ts` gains resolved defaults with sources; `search_items`
  and `lookup_item_code` in `packages/mcp-server/src/lib/tools/catalog.ts`, registered in `register-all-tools.ts`.
  Files: `packages/mcp-server/src/lib/tools/products.ts`, `packages/mcp-server/src/lib/tools/catalog.ts`,
  `packages/mcp-server/src/lib/tools/register-all-tools.ts`. Test: `packages/mcp-server/src/lib/tools/catalog.spec.ts`
  and `packages/mcp-server/src/lib/tools/input-schema-json.spec.ts` (input schemas). [1]
- [ ] **T38**. Product bulk endpoint accepts the new fields (`core/src/lib/product/product.bulk.ts`). Files:
  `packages/core/src/lib/product/product.bulk.ts`. Test: `packages/core/src/lib/product/product.service.bulk-scope.spec.ts`
  (new fields written; per-row refusals). [2]
- [ ] **T39**. OpenAPI regenerated; SDK regeneration noted for the release. Files: `packages/core/src/lib/bootstrap/swagger.ts`. Test: OpenAPI diff is additive. [2]
- [ ] **T40**. User docs (item master, units, barcodes, variants, bundles, defaults) and `docs/specs/README.md` row.
  Files: docs site `website/docs/inventory/`, `docs/specs/README.md`. Test: docs build. [2]

## Phase 5 — Advanced capabilities (rollout phase 3)

- [ ] **T41**. Duplicate detection: the scorer (normalised name similarity, barcode, part, supplier code),
  `/items/duplicate-check` on save with the reason when continuing, and the item duplicate rules on the item's import
  part, so imports and the platform scan use the same scorer. Files: `C/duplicates/item-duplicate.scorer.ts`,
  `C/duplicates/item-duplicate.controller.ts`, `C/data-exchange/item-record-type.parts.ts`. Test:
  `C/duplicates/item-duplicate.scorer.spec.ts` (name similarity above 0.85, shared part or supplier code; reason kept
  when continuing).
- [ ] **T42**. Items in the nightly duplicate scan of `data-import-export` (dismiss and merge from its screens,
  opened from the item list and page; Inbox notice to holders of `PRODUCTS_MERGE`; on `data-import-export` T45). Files:
  `C/duplicates/item-duplicate-scan.listener.ts`, `CU/components/item-duplicates-entry/`. Test:
  `C/duplicates/item-duplicate-scan.listener.spec.ts` (Inbox notice once per scan; a dismissed pair not listed
  again).
- [ ] **T43**. Completeness: refresh job, `/items/:id/completeness`, completeness report and page. Files:
  `C/item-completeness/item-completeness.service.ts`, `C/item-completeness/item-completeness.scheduler.ts`,
  `C/catalog-item/catalog-item.controller.ts`, `C/reports/catalog-report.definitions.ts`,
  `CU/components/completeness/`. Test: `C/item-completeness/item-completeness.service.spec.ts` (score per channel and
  language; gaps listed).
- [ ] **T44**. Bulk edit: the item list opens a `data-import-export` bulk change of target `Product` (preview,
  apply through the product bulk path, per-row results, undo within 24 hours); specs incl. resume and skipped rows on
  undo (on `data-import-export` T29). Files: `C/data-exchange/item-bulk-change.target.ts`,
  `CU/components/item-bulk-edit-entry/`. Test: `C/data-exchange/item-bulk-change.target.spec.ts` (5,000 rows; resume
  applies no row twice; rows changed since are skipped on undo).
- [ ] **T45**. AI translation drafts: `/item-translation-drafts`, operation `CATALOG_TRANSLATION_DRAFTS` through
  `CATALOG_ASSISTANT` (purpose `catalog.translation-draft`), approve and reject, drafts hidden from documents;
  Translations section review list. Files: `C/item-translation-draft/item-translation-draft.service.ts`,
  `C/item-translation-draft/item-translation-draft.controller.ts`, `C/operations/catalog-operations.ts`,
  `CU/components/translations-section/`. Test: `C/item-translation-draft/item-translation-draft.service.spec.ts`
  (drafts off documents until approved; reject in one call).
- [ ] **T46**. MCP writing tools: `create_product` and `update_product` (`products.ts`) with `preview`, resolved
  defaults and duplicates; `generate_item_variants`, `bulk_edit_items` (a bulk change of target `Product`),
  `list_item_duplicates`, `draft_item_translations` in `catalog.ts`. Files:
  `packages/mcp-server/src/lib/tools/products.ts`, `packages/mcp-server/src/lib/tools/catalog.ts`. Test:
  `packages/mcp-server/src/lib/tools/catalog.spec.ts` (a preview writes nothing; the caller's permissions apply).
- [ ] **T47**. Real-time hints for `catalog.*` events (lists, item page, registers) through the `realtime` plugin;
  e2e test of the 2-second update. Files: `C/events/catalog-realtime-hints.ts`, `CU/services/catalog-realtime.service.ts`.
  Test: `C/events/catalog-realtime-hints.spec.ts` (hint within 2 seconds of the commit).
- [ ] **T48**. Duplicate candidates report (a definition over the `data-import-export` candidates of type
  `Product`); spec status `Implemented`. Files: `C/reports/catalog-report.definitions.ts`,
  `docs/specs/features/item-catalogue/spec.md`. Test: `C/reports/catalog-report.definitions.spec.ts` (the report lists a
  seeded duplicate pair of products).
- [ ] **T49**. Provide the ports other features bind to (plan, **Consumer tokens answered**): `DOCUMENT_UNITS`, `MANUFACTURING_CATALOG`. Files: `apps/api/src/plugin-composition.ts`. Test:
`C/catalog-consumer-tokens.contract.spec.ts`, one contract test per token over the shape its consumer plan states; with this feature off each consumer keeps its stated fallback.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Access, gates and screens | T8, T30 |
| FR-2 | §3.1 Access, gates and screens | T2, T8 |
| FR-3 | §3.1 Access, gates and screens | T2 |
| FR-4 | §3.1 Access, gates and screens | T31 |
| FR-5 | §3.2 Item master | T3, T32 |
| FR-6 | §3.2 Item master | T7, T50 |
| FR-7 | §3.2 Item master | T50 |
| FR-8 | §3.2 Item master | T22, T52 |
| FR-9 | §3.2 Item master | T7, T24 |
| FR-10 | §3.2 Item master | T24, T25, T34 |
| FR-11–FR-14 | §3.3 Item kinds | T10 |
| FR-15 | §3.4 Item groups, brands and defaults | T12, T31 |
| FR-16 | §3.4 Item groups, brands and defaults | T11, T23 |
| FR-17–FR-19 | §3.4 Item groups, brands and defaults | T12 |
| FR-20–FR-25 | §3.5 Units and conversions | T13 |
| FR-26 | §3.6 Barcodes and lookup | T14 |
| FR-27 | §3.6 Barcodes and lookup | T14 |
| FR-28 | §3.6 Barcodes and lookup | T15 |
| FR-29 | §3.6 Barcodes and lookup | T27 |
| FR-30 | §3.7 Attributes and variants | T16 |
| FR-31 | §3.7 Attributes and variants | T17 |
| FR-32 | §3.7 Attributes and variants | T17, T33 |
| FR-33 | §3.7 Attributes and variants | T17, T26 |
| FR-34 | §3.7 Attributes and variants | T16 |
| FR-35 | §3.7 Attributes and variants | T18 |
| FR-36 | §3.7 Attributes and variants | T17, T19 |
| FR-37 | §3.7 Attributes and variants | T18 |
| FR-38 | §3.7 Attributes and variants | T16 |
| FR-39 | §3.8 Alternatives, relations, manufacturers and codes | T19 |
| FR-40 | §3.8 Alternatives, relations, manufacturers and codes | T19, T34 |
| FR-41 | §3.8 Alternatives, relations, manufacturers and codes | T11, T19 |
| FR-42 | §3.8 Alternatives, relations, manufacturers and codes | T19 |
| FR-43 | §3.8 Alternatives, relations, manufacturers and codes | T19, T34 |
| FR-44–FR-49 | §3.9 Bundles and kits | T20 |
| FR-50–FR-51 | §3.10 Commercial and buying attributes | T21 |
| FR-52 | §3.10 Commercial and buying attributes | T21, T34 |
| FR-53–FR-54 | §3.10 Commercial and buying attributes | T21 |
| FR-55 | §3.11 Translations and media | T11, T16, T31, T34 |
| FR-56 | §3.11 Translations and media | T31, T34 |
| FR-57 | §3.11 Translations and media | T45 |
| FR-58 | §3.12 Search, item page and data quality | T23 |
| FR-59 | §3.12 Search, item page and data quality | T22, T51 |
| FR-60 | §3.12 Search, item page and data quality | T41 |
| FR-61 | §3.12 Search, item page and data quality | T42 |
| FR-62 | §3.12 Search, item page and data quality | T43 |
| FR-63–FR-64 | §3.13 Bulk edit, code change and merge | T44 |
| FR-65 | §3.13 Bulk edit, code change and merge | T24 |
| FR-66 | §3.13 Bulk edit, code change and merge | T24 |
| FR-67 | §3.14 Reports | T28, T35, T43, T48 |
| FR-68 | §3.15 Real time, events and agents | T47 |
| FR-69 | §3.15 Real time, events and agents | T25 |
| FR-70 | §3.15 Real time, events and agents | T37, T46 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling `FEATURE_ITEM_MASTER` in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- Every catalogue route answers `404` with `FEATURE_CATALOG` off; every new route answers `404` with
  `FEATURE_ITEM_MASTER` off.
- Lookup P95 < 50 ms and search P95 < 200 ms measured on 100,000 items.
- Every MCP writing tool proven side-effect free with `preview: true`.
