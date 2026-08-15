/**
 * Selectors for the **Documents hub** (`@gauzy/plugin-docs-ui`, `/#/pages/documents`).
 *
 * This is the NEW hub (tree sidebar + table + detail panel + page editor + review queue) specified in
 * `specs/documents/01-ux-spec.md`. It is NOT the legacy `organization-documents` grid — that one keeps
 * its own `OrganizationDocumentsPageObject`.
 *
 * Selector policy for this file, in priority order:
 *   1. **Plugin-owned element names** (`gz-docs-*`, `gz-document-editor`) — they come straight from the
 *      components' `selector:` and change only when the component itself is renamed.
 *   2. **Plugin-owned CSS classes** written in the component templates (`.docs-browse`, `.gz-save-pill`,
 *      `.docs-badge.ready`) — these carry STATE, so they are the right hook for "is it Ready yet?".
 *   3. **Static attributes** the template hard-codes: `nb-icon[icon="upload-outline"]`,
 *      `button[status="primary"]`, `button[role="menuitem"]`.
 *
 * 🛑 Deliberately NOT keyed on rendered text. Every visible label here goes through the `DOCS.*`
 * translation namespace, and this suite runs serially against ONE account whose `preferredLanguage` the
 * `change-language` feature mutates — a text-keyed selector silently stops matching when that scenario
 * runs first (the same trap `util.ts#scopeGridTo` documents for `[placeholder="…"]`). Icon names and
 * status attributes are language-proof; use those.
 *
 * ⚠️ Fragility notes are inline on the few selectors that had no stable hook to key on.
 */
export const DocumentsHubPage = {
	// ── Navigation entry (UX spec §1) ────────────────────────────────────────────────────────────
	// `<ga-menu-item [id]="item?.id">` binds the nav config's `id` onto the host element, so the
	// plugin's `id: 'documents'` IS the DOM id. The host also carries `*ngxPermissionsOnly` and the
	// sidebar drops `item.hidden` entries, so the mere PRESENCE of this element proves the org has
	// FEATURE_DOCUMENTS enabled and the user holds DOCS_READ — that is what the availability guard reads.
	navMenuItemCss: 'ga-menu-item#documents',
	navMenuItemLinkCss: 'ga-menu-item#documents a[href*="/pages/documents"]',

	// ── Shell (docs-shell.component.html, UX spec §2) ────────────────────────────────────────────
	shellCss: '.docs-shell',
	treeColumnCss: '.docs-shell .docs-tree-column',
	detailColumnCss: '.docs-shell .docs-detail-column',

	// ── Tree sidebar (gz-docs-tree, UX spec §3) ──────────────────────────────────────────────────
	treeCss: 'gz-docs-tree',
	treeSectionTitleCss: 'gz-docs-tree .docs-tree-section-title',
	treeNodeCss: 'gz-docs-tree .docs-tree-node',
	treeNodeNameCss: 'gz-docs-tree .docs-tree-node-name',
	treeEmptyCss: 'gz-docs-tree .docs-tree-empty',

	// ── Browse page header (docs-browse-page.component.html) ─────────────────────────────────────
	browseCss: '.docs-browse',
	browseTitleCss: '.docs-browse-title',
	browseActionsCss: '.docs-browse-actions',
	// Keyed on the hard-coded `nb-icon` names rather than the translated labels (see file header).
	uploadButtonCss: '.docs-browse-actions button:has(nb-icon[icon="upload-outline"])',
	// Creating a page is no longer its own header button: the revamp folded Folder/Page behind a
	// `New ▾` nb-contextMenu (a folder was otherwise unreachable on a brand-new org). The trigger is
	// the only `plus-outline` in this header.
	newMenuTriggerCss: '.docs-browse-actions button:has(nb-icon[icon="plus-outline"])',
	// The menu items are NbMenuItem models, so their icons are `[config]`-bound — no `icon` attribute
	// reaches the DOM and the icon-name convention above cannot be used here. Nebular renders each
	// item as `<a [attr.title]>…<span class="menu-title">`, so match the label: Playwright's
	// `:has-text()` is a case-insensitive SUBSTRING match, which absorbs the "New page"/"New Page"
	// difference between the docs-ui and ui-core catalogues, and "New page" cannot match "New folder".
	newMenuPageItemCss: 'nb-context-menu a:has-text("New page")',
	reviewQueueButtonCss: '.docs-browse-actions button:has(nb-icon[icon="checkmark-circle-outline"])',
	viewToggleCss: '.docs-view-toggle',
	// The multi-file picker the Upload button proxies (`fileInput.nativeElement.click()`). It is
	// `hidden`, which is exactly what `setInputFiles` is for — see DocumentsHub.po#uploadFiles.
	fileInputCss: '.docs-browse input[type="file"]',
	dropOverlayCss: '.docs-browse .docs-drop-overlay',

	// ── Preset chips (gz-docs-preset-chips, UX spec §5) ──────────────────────────────────────────
	presetChipCss: 'gz-docs-preset-chips .docs-presets button',
	// ⚠️ FRAGILE-ish: the chips are an *ngFor over `PresetChipsComponent.chips` with no per-chip id,
	// class or data attribute, so INDEX is the only language-proof handle. The order is fixed in the
	// component (All, Needs review, Not in AI knowledge, Archived); if a chip is inserted these shift.
	presetChipAllIndex: 0,
	presetChipNeedsReviewIndex: 1,
	presetChipNotInKnowledgeIndex: 2,
	presetChipArchivedIndex: 3,
	presetCountCss: '.docs-preset-count',

	// ── Filter bar (gz-docs-filter-bar, UX spec §5) ──────────────────────────────────────────────
	filterBarCss: 'gz-docs-filter-bar',
	// The free-text search box. Scoped to `.docs-filter-search` because the facet row also renders
	// text inputs (the two `nb-rangepicker` fields). Debounces 500 ms (DOCS_SEARCH_DEBOUNCE_MS).
	searchInputCss: 'gz-docs-filter-bar .docs-filter-search input[type="text"]',
	searchContentToggleCss: 'gz-docs-filter-bar .docs-filter-search nb-toggle',
	// No call site yet, but the class it used to hang off (`.docs-filter-facets`) no longer exists
	// anywhere in docs-ui — the clear-all button now lives in the filter bar's actions field. Corrected
	// rather than left to mislead whoever wires this up.
	clearAllButtonCss:
		'gz-docs-filter-bar .docs-filter-field--actions button:has(nb-icon[icon="close-circle-outline"])',

	// ── Upload flow (UX spec §7) ─────────────────────────────────────────────────────────────────
	// Pre-upload classification dialog. NbDialogService mounts the component itself, so the component
	// element name is a stable, overlay-proof scope (several other dialogs share `.docs-dialog`).
	classificationDialogCss: 'gz-docs-classification-dialog',
	classificationStartButtonCss: 'gz-docs-classification-dialog nb-card-footer button[status="primary"]',
	classificationCancelButtonCss: 'gz-docs-classification-dialog nb-card-footer button:not([status])',
	classificationKnowledgeToggleCss: 'gz-docs-classification-dialog nb-toggle',

	uploadProgressCss: 'gz-docs-upload-progress',
	uploadRowCss: 'gz-docs-upload-progress .docs-upload-row',
	uploadNameCss: 'gz-docs-upload-progress .docs-upload-name',
	// Per-row terminal states — CLASS-based, so they read the same in every language.
	uploadDoneCss: '.docs-upload-state.done',
	uploadErrorCss: '.docs-upload-state.error',

	// ── Table view (gz-docs-table, UX spec §4.1) ─────────────────────────────────────────────────
	tableCss: 'gz-docs-table',
	// Same row selector the rest of this suite uses for angular2-smart-table grids, scoped to the hub.
	tableRowCss: 'gz-docs-table table > tbody > tr.angular2-smart-row',
	nameCellCss: 'gz-docs-name-cell',
	nameTextCss: 'gz-docs-name-cell .docs-name-text',
	// Processing status pill. `.docs-badge` gets exactly one of ready|processing|failed appended.
	statusBadgeCss: 'gz-docs-status-badge .docs-badge',
	statusReadyClass: 'ready',
	statusProcessingClass: 'processing',
	statusFailedClass: 'failed',
	knowledgeBadgeCss: 'gz-docs-knowledge-badge',
	emptyStateCss: 'gz-docs-empty-state',
	paginationCss: '.pagination-container ga-pagination',

	// ── Detail side panel (gz-docs-detail-panel, UX spec §8) ─────────────────────────────────────
	detailPanelCss: 'gz-docs-detail-panel',
	detailNameCss: 'gz-docs-detail-panel .docs-detail-name',
	detailBadgesCss: 'gz-docs-detail-panel .docs-detail-badges',
	detailCloseButtonCss: 'gz-docs-detail-panel .docs-detail-close',
	detailSectionCss: 'gz-docs-detail-panel .docs-detail-section',
	detailMetadataCss: 'gz-docs-detail-panel .docs-detail-meta',
	detailReviewBannerCss: 'gz-docs-detail-panel .docs-review-banner',
	detailReviewApproveButtonCss: 'gz-docs-detail-panel .docs-review-banner-actions button[status="success"]',

	// ── Create (folder/page) dialog ──────────────────────────────────────────────────────────────
	createDialogCss: 'gz-docs-create-dialog',
	createNameInputCss: '#docs-create-name',
	createConfirmButtonCss: 'gz-docs-create-dialog nb-card-footer button[status="primary"]',

	// ── Page editor chrome (document-page.component.html, UX spec §10) ───────────────────────────
	pageEditorCss: 'nb-card.gz-page-editor',
	editorTitleInputCss: '.gz-page-editor .gz-title-input',
	editorBreadcrumbsCss: '.gz-page-editor .gz-breadcrumbs',
	// Autosave pill. saved and saving BOTH render class-less, so read the icon: checkmark = saved,
	// loader = saving. `.warning` / `.danger` are offline / (error|conflict).
	savePillCss: '.gz-page-editor .gz-save-pill',
	savePillSavedCss: '.gz-page-editor .gz-save-pill:has(nb-icon[icon="checkmark-outline"])',
	savePillSavingCss: '.gz-page-editor .gz-save-pill:has(nb-icon[icon="loader-outline"])',
	savePillFailedCss: '.gz-page-editor .gz-save-pill.danger',
	overflowButtonCss: '.gz-page-editor .gz-overflow > button',
	overflowPanelCss: '.gz-page-editor .gz-overflow-panel',
	// Overflow items keyed on their icons — see the file header on why not on their labels.
	overflowSaveVersionItemCss: '.gz-overflow-panel button[role="menuitem"]:has(nb-icon[icon="save-outline"])',
	overflowVersionHistoryItemCss: '.gz-overflow-panel button[role="menuitem"]:has(nb-icon[icon="clock-outline"])',

	// ── Rich editor surface (gz-document-editor) ─────────────────────────────────────────────────
	editorHostCss: 'gz-document-editor',
	// TipTap mounts ProseMirror into `.gz-editor-mount` and merges `editorProps.attributes.class`
	// onto the contenteditable, so the live element is `<div class="ProseMirror gz-document-editor-content"
	// contenteditable="true">`. Key on the PLUGIN's class, not on `.ProseMirror` (that one is shared with
	// every other TipTap instance on the page — e.g. `ga-rich-text-editor`, which is what util.ts's
	// `fillRichTextEditor` targets and why that helper does NOT work here).
	editorContentCss: 'gz-document-editor .gz-document-editor-content',

	// ── Version history (gz-docs-version-history, UX spec §10.7) ─────────────────────────────────
	versionHistoryCss: 'gz-docs-version-history',
	versionRowCss: 'gz-docs-version-history .gz-version-row',
	versionNameCss: 'gz-docs-version-history .gz-version-name',
	versionMetaCss: 'gz-docs-version-history .gz-version-meta',
	versionEmptyCss: 'gz-docs-version-history .gz-versions-empty',
	versionPreviewCss: 'gz-docs-version-history .gz-version-preview',
	// Two-step confirm: primary "Restore" arms it, danger "Restore" commits.
	versionRestoreButtonCss: 'gz-docs-version-history .gz-version-preview-actions button[status="primary"]',
	versionRestoreConfirmButtonCss: 'gz-docs-version-history .gz-version-preview-actions button[status="danger"]',

	// ── Review queue (review-page.component.html, UX spec §11) ───────────────────────────────────
	reviewPageCss: '.docs-review',
	reviewListCss: '.docs-review-list',
	// The header row shares `.docs-review-row`, hence the :not().
	reviewRowCss: '.docs-review-list .docs-review-row:not(.docs-review-row-head)',
	reviewRowNameCss: 'gz-docs-name-cell .docs-name-text',
	reviewApproveButtonCss: 'button[status="success"]',
	reviewRejectButtonCss: 'button[status="danger"]',
	// The `review-empty` empty-state variant is the only one whose icon carries `.success`.
	reviewEmptyStateCss: '.docs-review gz-docs-empty-state .docs-empty-icon.success',
	reviewBulkBarCss: '.docs-review .docs-bulk-bar',

	// ── Shared ───────────────────────────────────────────────────────────────────────────────────
	toastrMessageCss: 'nb-toast.ng-trigger',
	spinnerCss: 'nb-spinner'
};
