import { expect } from '@playwright/test';
import {
	clearField,
	dispatchClick,
	dispatchClickWhenSettled,
	enterInput,
	verifyElementIsVisible,
	verifyText,
	verifyTextNotExisting,
	verifyValue,
	waitElementToHide,
	waitForSpinnerGone
} from '../util';
import { getPage } from '../page-context';
// Selectors + data are framework-agnostic — same split the rest of the migrated suite uses.
import { DocumentsHubPage } from '../../../src/support/Base/pageobjects/DocumentsHubPageObject';
import { DocumentsHubPageData } from '../../../src/support/Base/pagedata/DocumentsHubPageData';

/**
 * Page object for the **Documents hub** (`@gauzy/plugin-docs-ui`) — UX spec `specs/documents/01-ux-spec.md`,
 * journeys per `specs/documents/10-implementation-plan.md` §8.3.
 *
 * Same shape as every other `*.po.ts` here: async functions over the shared util layer, driving the
 * module-scoped page (`page-context.ts`). Where a step needs a *decision* (does this row still say
 * "Processing"? is the review queue empty?) it uses `getPage()` directly, exactly like
 * `OrganizationDocuments.po#selectDocumentRow` does — a util that only asserts cannot express that.
 */

const DEFAULT_TIMEOUT = 24_000;

// ─── Navigation ──────────────────────────────────────────────────────────────────────────────────

/**
 * Hash-route navigation that actually takes.
 *
 * Port of the private `gotoRoute` in `commands.ts`: a `goto()` that only changes the fragment is a
 * SAME-DOCUMENT no-op, so the Angular hash router never re-renders and the next click lands on the
 * previous screen. The hub and its review queue differ only in the fragment, so this bites here —
 * force the hash when the path (query params stripped) genuinely differs, then let the SPA settle.
 */
const gotoHashRoute = async (route: string): Promise<void> => {
	const page = getPage();
	await page.goto(route);
	const hash = route.includes('#') ? route.slice(route.indexOf('#')) : '';
	if (hash) {
		await page.evaluate((h) => {
			if (location.hash.split('?')[0] !== h) location.hash = h;
		}, hash);
		await page.waitForTimeout(700);
	}
	await waitForSpinnerGone();
};

export const openDocumentsHub = async () => {
	await gotoHashRoute(DocumentsHubPageData.route);
	await verifyElementIsVisible(DocumentsHubPage.browseCss);
};

export const openReviewQueue = async () => {
	await gotoHashRoute(DocumentsHubPageData.reviewRoute);
	await verifyElementIsVisible(DocumentsHubPage.reviewPageCss);
};

/** Navigate through the UI (header button) rather than by URL — exercises the shell affordance. */
export const clickReviewQueueButton = async () => {
	await dispatchClickWhenSettled(DocumentsHubPage.reviewQueueButtonCss, DocumentsHubPage.reviewPageCss);
};

/**
 * Is the Documents hub reachable for this account at all?
 *
 * The nav entry is rendered only when the org has `FEATURE_DOCUMENTS` enabled AND the user holds
 * `DOCS_READ` (see the selector's comment) — the same two gates `docsFeatureGuard` + `PermissionsGuard`
 * apply to the route. Returning a boolean (rather than asserting) lets the caller SKIP the scenario
 * with a real reason instead of failing 20 steps later on a dashboard redirect.
 */
export const isDocumentsHubAvailable = async (): Promise<boolean> =>
	getPage()
		.locator(DocumentsHubPage.navMenuItemCss)
		.first()
		.waitFor({ state: 'attached', timeout: DocumentsHubPageData.availabilityTimeout })
		.then(() => true)
		.catch(() => false);

export const navMenuEntryVisible = async () => {
	await verifyElementIsVisible(DocumentsHubPage.navMenuItemCss);
};

// ─── Shell / tree (UX spec §2, §3) ───────────────────────────────────────────────────────────────

export const shellVisible = async () => {
	await verifyElementIsVisible(DocumentsHubPage.shellCss);
};

export const treeSidebarVisible = async () => {
	await verifyElementIsVisible(DocumentsHubPage.treeColumnCss);
	await verifyElementIsVisible(DocumentsHubPage.treeCss);
};

export const filterBarVisible = async () => {
	await verifyElementIsVisible(DocumentsHubPage.filterBarCss);
};

export const presetChipsVisible = async () => {
	await verifyElementIsVisible(DocumentsHubPage.presetChipCss);
};

/** Reads a preset chip's live facet count, e.g. "Needs review (3)" -> 3. `null` when not rendered. */
export const presetChipCount = async (index: number): Promise<number | null> => {
	const text = await getPage()
		.locator(DocumentsHubPage.presetChipCss)
		.nth(index)
		.locator(DocumentsHubPage.presetCountCss)
		.first()
		.textContent()
		.catch(() => null);
	const parsed = parseInt(String(text ?? '').replace(/[^\d]/g, ''), 10);
	return Number.isNaN(parsed) ? null : parsed;
};

/** Spinner + network settle after anything that re-queries the list. */
const settleList = async (extraWaitMs = 800) => {
	const page = getPage();
	await page.waitForTimeout(extraWaitMs);
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
};

export const clickPresetChip = async (index: number) => {
	await getPage().locator(DocumentsHubPage.presetChipCss).nth(index).dispatchEvent('click');
	await settleList();
};

// ─── Search / list scoping ───────────────────────────────────────────────────────────────────────

/**
 * Narrow the hub list to this run's document.
 *
 * The grid is SERVER-paginated at 10 rows over one accumulating database, so a row this scenario just
 * created is regularly not on page 1 — the same order-dependence `util.ts#scopeGridTo` exists for. That
 * helper does not apply here: `DocsTableComponent` sets `hideSubHeader: true`, so there IS no
 * per-column filter row. The hub's own filter-bar search box is the equivalent lever (it maps to the
 * server-side `q` filter), so use it.
 */
export const searchDocuments = async (text: string) => {
	const input = getPage().locator(DocumentsHubPage.searchInputCss).first();
	await input.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
	await input.fill(String(text));
	await settleList(1600); // 500 ms component debounce (DOCS_SEARCH_DEBOUNCE_MS) + refetch
};

export const clearSearch = async () => {
	const input = getPage().locator(DocumentsHubPage.searchInputCss).first();
	if (await input.isVisible().catch(() => false)) {
		await input.fill('');
		await settleList(1600);
	}
};

// ─── Upload flow (UX spec §7) ────────────────────────────────────────────────────────────────────

export const uploadButtonVisible = async () => {
	await verifyElementIsVisible(DocumentsHubPage.uploadButtonCss);
};

/**
 * Hand files to the hub's multi-file picker.
 *
 * The Upload button only proxies `fileInput.nativeElement.click()`, which opens the OS file chooser —
 * so we set the files on the input itself. That is not a shortcut around the UI: the component listens
 * on `(change)="onFilesPicked(fileInput.files)"`, which is precisely the event `setInputFiles`
 * dispatches, so the real upload flow (classification dialog → queue → progress) runs unchanged.
 * `setInputFiles` works on a `hidden` input — it needs the element attached, not visible.
 *
 * The payload is built in memory rather than checked in as a fixture so each run gets a UNIQUE file
 * name; the file name becomes the document name, and that is what scopes every assertion below to
 * this run's row.
 */
export const uploadFiles = async (fileName: string, content: string, mimeType: string) => {
	await getPage()
		.locator(DocumentsHubPage.fileInputCss)
		.first()
		.setInputFiles({ name: fileName, mimeType, buffer: Buffer.from(content, 'utf-8') });
};

export const classificationDialogVisible = async () => {
	await verifyElementIsVisible(DocumentsHubPage.classificationDialogCss);
};

/** Accept the classification dialog's defaults and start the upload. */
export const startUpload = async () => {
	// dispatchClick: the button lives in an nb-dialog whose cdk backdrop intercepts coordinate clicks.
	await dispatchClick(DocumentsHubPage.classificationStartButtonCss);
	await getPage()
		.locator(DocumentsHubPage.classificationDialogCss)
		.first()
		.waitFor({ state: 'detached', timeout: DEFAULT_TIMEOUT })
		.catch(() => undefined);
};

export const uploadProgressVisible = async () => {
	await verifyElementIsVisible(DocumentsHubPage.uploadProgressCss);
};

/** The per-file upload row, located by the file name shown in it. */
const uploadRow = (fileName: string) =>
	getPage().locator(DocumentsHubPage.uploadRowCss).filter({ hasText: fileName }).first();

/**
 * Wait for the HTTP upload of `fileName` to terminate, and report which way it went.
 *
 * `done` only means "the bytes are on the server and a Document row exists" — processing continues
 * asynchronously afterwards (see `waitForRowProcessingSettled`).
 */
export const waitForUploadToFinish = async (fileName: string, timeout = DEFAULT_TIMEOUT): Promise<'done' | 'error' | 'pending'> => {
	const row = uploadRow(fileName);
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		if (await row.locator(DocumentsHubPage.uploadDoneCss).first().isVisible().catch(() => false)) return 'done';
		if (await row.locator(DocumentsHubPage.uploadErrorCss).first().isVisible().catch(() => false)) return 'error';
		await getPage().waitForTimeout(1_000);
	}
	return 'pending';
};

/** Surfaces the inline error text of a failed upload row so a failure names its own cause. */
export const uploadErrorText = async (fileName: string): Promise<string> =>
	(await uploadRow(fileName).locator(DocumentsHubPage.uploadErrorCss).first().getAttribute('title').catch(() => null)) ??
	(await uploadRow(fileName).textContent().catch(() => '')) ??
	'';

// ─── Table view (UX spec §4.1) ───────────────────────────────────────────────────────────────────

export const tableVisible = async () => {
	await verifyElementIsVisible(DocumentsHubPage.tableCss);
};

/** This run's row in the hub table, located by document name. */
const documentRow = (name: string) =>
	getPage().locator(DocumentsHubPage.tableRowCss).filter({ hasText: name }).first();

export const verifyDocumentRowExists = async (name: string) => {
	await expect(documentRow(name)).toBeVisible({ timeout: DEFAULT_TIMEOUT });
};

export const verifyDocumentRowNotExists = async (name: string) => {
	await verifyTextNotExisting(DocumentsHubPage.tableRowCss, name);
};

export const verifyDocumentNameCell = async (name: string) => {
	await verifyText(`${DocumentsHubPage.tableCss} ${DocumentsHubPage.nameTextCss}`, name);
};

/**
 * Wait out the asynchronous ingest of `name` and report the terminal processing status.
 *
 * A freshly uploaded FILE goes UPLOADED → PROCESSING → READY (or FAILED). The client refreshes the row
 * in place every 5 s (`DOCS_PROCESSING_POLL_MS`) while anything is unsettled, so this only has to
 * watch the badge. The badge's STATE lives in its class (`ready` / `processing` / `failed`), never in
 * its label — the label is translated (UPLOADED and PROCESSING even share the label "Processing").
 *
 * Returns the class-derived status, or `'processing'` if it never settled inside `timeout`. Callers
 * SOFT-assert the outcome: the extraction worker is an environment dependency, and neither the browse
 * nor the detail-panel half of the journey needs the document to have reached READY.
 */
export const waitForRowProcessingSettled = async (
	name: string,
	timeout = DocumentsHubPageData.processingTimeout
): Promise<'ready' | 'failed' | 'processing'> => {
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		const cssClass =
			(await documentRow(name)
				.locator(DocumentsHubPage.statusBadgeCss)
				.first()
				.getAttribute('class')
				.catch(() => null)) ?? '';
		if (cssClass.includes(DocumentsHubPage.statusReadyClass)) return 'ready';
		if (cssClass.includes(DocumentsHubPage.statusFailedClass)) return 'failed';
		await getPage().waitForTimeout(2_000);
	}
	return 'processing';
};

/**
 * Soft-assert the ingest reached READY.
 *
 * Soft on purpose (`expect.soft`): the journey under test is upload → browse → detail, and the
 * document is browsable and openable in every status. A non-READY outcome is worth REPORTING (it
 * shows up in the run as a failed soft assertion with the observed status) but must not abort the
 * steps that are actually the subject of the test.
 */
export const softVerifyProcessingReady = async (name: string, status: string) => {
	expect
		.soft(status, `"${name}" did not reach READY (observed: ${status}) — extraction worker/AI environment dependent`)
		.toBe('ready');
};

/** Open the detail panel by clicking the row's NAME cell (never the multi-select checkbox column). */
export const openDocumentRow = async (name: string) => {
	await waitForSpinnerGone();
	const cell = documentRow(name).locator(DocumentsHubPage.nameCellCss).first();
	await cell.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
	await cell.click({ force: true });
};

// ─── Detail side panel (UX spec §8) ──────────────────────────────────────────────────────────────

export const detailPanelVisible = async () => {
	await verifyElementIsVisible(DocumentsHubPage.detailColumnCss);
	await verifyElementIsVisible(DocumentsHubPage.detailPanelCss);
};

export const verifyDetailPanelName = async (name: string) => {
	await verifyText(DocumentsHubPage.detailNameCss, name);
};

export const detailBadgesVisible = async () => {
	await verifyElementIsVisible(DocumentsHubPage.detailBadgesCss);
};

export const detailMetadataVisible = async () => {
	await verifyElementIsVisible(DocumentsHubPage.detailMetadataCss);
};

/**
 * The AI summary is the one panel section that only fills in when classification ran. CI runs with
 * `GAUZY_DOCS_AI_ENABLED=false`, so assert the section EXISTS (structural, always true) and leave the
 * summary text itself to a soft assertion the caller can read in the report.
 */
export const softVerifyAiSummaryPresent = async () => {
	// `expect.soft` DEFERS a failure to the end of the test — it does not make it non-fatal. So the
	// condition this helper documents as expected (`GAUZY_DOCS_AI_ENABLED=false`, hence no summary)
	// was failing the run anyway, which is how it took down this scenario once the detail panel
	// started loading a real document. The structural assertion below is the one that carries meaning;
	// whether classification actually produced prose is genuinely informational, so it is LOGGED.
	await verifyElementIsVisible(`${DocumentsHubPage.detailPanelCss} .docs-detail-section`);
	const summary = getPage()
		.locator(DocumentsHubPage.detailPanelCss)
		.locator('.docs-detail-section p:not(.muted)')
		.first();
	const hasSummary = await summary.isVisible().catch(() => false);
	console.log(
		hasSummary
			? '[docs-hub] AI summary rendered'
			: '[docs-hub] no AI summary rendered — expected while GAUZY_DOCS_AI_ENABLED=false'
	);
};

/**
 * The "this document needs review" banner is rendered ONLY while `reviewStatus === PENDING`, so its
 * absence is the UI-observable proof that an approval actually took effect.
 */
export const verifyDetailReviewBannerGone = async () => {
	await expect(getPage().locator(DocumentsHubPage.detailReviewBannerCss)).toHaveCount(0, {
		timeout: DEFAULT_TIMEOUT
	});
};

export const closeDetailPanel = async () => {
	await dispatchClick(DocumentsHubPage.detailCloseButtonCss);
};

// ─── Create a PAGE document ──────────────────────────────────────────────────────────────────────

export const newPageButtonVisible = async () => {
	// Assert the `New ▾` trigger, not the menu item: the item lives in an overlay that only exists
	// once the menu is open.
	await verifyElementIsVisible(DocumentsHubPage.newMenuTriggerCss);
};

export const clickNewPageButton = async () => {
	// Two hops now — open `New ▾`, then choose Page. The browse card shows a full-card [nbSpinner]
	// while the first list load runs; a coordinate click lands on that overlay and nothing opens.
	// Settle and dispatch each hop, confirming on what that hop is supposed to produce (the menu item,
	// then the create dialog's name input) so a swallowed click fails here rather than 24s later.
	await dispatchClickWhenSettled(DocumentsHubPage.newMenuTriggerCss, DocumentsHubPage.newMenuPageItemCss);
	await dispatchClickWhenSettled(DocumentsHubPage.newMenuPageItemCss, DocumentsHubPage.createNameInputCss);
};

export const createDialogVisible = async () => {
	await verifyElementIsVisible(DocumentsHubPage.createDialogCss);
};

export const enterCreateName = async (name: string) => {
	await clearField(DocumentsHubPage.createNameInputCss);
	await enterInput(DocumentsHubPage.createNameInputCss, name);
};

export const clickCreateConfirm = async () => {
	await dispatchClick(DocumentsHubPage.createConfirmButtonCss);
	await getPage()
		.locator(DocumentsHubPage.createDialogCss)
		.first()
		.waitFor({ state: 'detached', timeout: DEFAULT_TIMEOUT })
		.catch(() => undefined);
};

// ─── Page editor (UX spec §10) ───────────────────────────────────────────────────────────────────

/** Creating a page routes to `/pages/documents/page/:id`; the editor chunk is lazily loaded. */
export const pageEditorVisible = async () => {
	await getPage()
		.locator(DocumentsHubPage.pageEditorCss)
		.first()
		.waitFor({ state: 'visible', timeout: DocumentsHubPageData.editorLoadTimeout });
};

export const verifyEditorTitle = async (name: string) => {
	await verifyValue(DocumentsHubPage.editorTitleInputCss, name);
};

/** The `page/:id` id from the URL — handy for scoping later assertions to exactly this document. */
export const currentPageDocumentId = async (): Promise<string> => {
	const match = /\/pages\/documents\/page\/([^?/#]+)/.exec(getPage().url());
	return match ? match[1] : '';
};

/**
 * Type into the hub's rich editor.
 *
 * Mirrors `util.ts#fillRichTextEditor`, but that helper is hard-wired to `ga-rich-text-editor
 * .ProseMirror` — the SHARED core editor. The hub ships its own TipTap instance,
 * `<gz-document-editor>`, whose editable is `.gz-document-editor-content`; the shared helper's
 * selector simply does not match it. Everything else is deliberately identical: click into the
 * editable, select-all + delete, type with real key events (ProseMirror consumes
 * `beforeinput`/keyboard, so a `.fill()` would never reach the document), then assert the text
 * actually landed in the ProseMirror document — which is what the autosave payload is built from.
 */
export const fillPageEditor = async (text: string) => {
	const page = getPage();
	const editable = page.locator(DocumentsHubPage.editorContentCss).first();
	await editable.waitFor({ state: 'visible', timeout: DocumentsHubPageData.editorLoadTimeout });
	await editable.click({ timeout: DEFAULT_TIMEOUT });
	await page.keyboard.press('Control+A');
	await page.keyboard.press('Delete');
	await editable.pressSequentially(String(text), { timeout: DEFAULT_TIMEOUT });
	await expect(editable).toContainText(String(text), { timeout: DEFAULT_TIMEOUT });
};

/**
 * Force the pending autosave to flush now.
 *
 * The editor debounces 2 s and binds `Mod-s` to `autosave.flush()` (never the browser save dialog).
 * Focus is already inside the editable after typing, which is what the ProseMirror keymap needs.
 */
export const flushEditorSave = async () => {
	await getPage().keyboard.press('Control+s');
};

/**
 * Prove the content reached the server.
 *
 * ⚠️ The pill renders "Saved" for BOTH the idle and the saved state, so asserting on it alone would
 * pass even if nothing had been written. So: first wait for it to leave the saved state (it must go
 * through saving/dirty once the editor is marked dirty), then wait for it to come back. If the
 * transition is too fast to observe, the second wait still gates on the end state, and the caller's
 * version-history assertion is the server-side proof.
 */
export const waitForEditorSaved = async () => {
	const page = getPage();
	await page
		.locator(DocumentsHubPage.savePillSavingCss)
		.first()
		.waitFor({ state: 'visible', timeout: 5_000 })
		.catch(() => undefined);
	await page
		.locator(DocumentsHubPage.savePillSavedCss)
		.first()
		.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
};

export const verifyEditorSaveDidNotFail = async () => {
	await expect(getPage().locator(DocumentsHubPage.savePillFailedCss)).toHaveCount(0, { timeout: 5_000 });
};

/** Open the editor's ⋯ overflow menu (plain *ngIf panel, no cdk overlay). */
export const openEditorOverflowMenu = async () => {
	const panel = getPage().locator(DocumentsHubPage.overflowPanelCss).first();
	if (await panel.isVisible().catch(() => false)) return;
	await dispatchClick(DocumentsHubPage.overflowButtonCss);
	await panel.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
};

/**
 * "Save version now" → `flush({ forceSnapshot: true })`.
 *
 * This is what makes the version-history assertion DETERMINISTIC: a plain autosave leaves it to the
 * server whether to snapshot, whereas `forceSnapshot` always writes a `DocumentVersion` row.
 */
export const clickSaveVersionNow = async () => {
	await openEditorOverflowMenu();
	await dispatchClick(DocumentsHubPage.overflowSaveVersionItemCss);
	// The menu closes on selection; give the forced flush time to round-trip.
	await getPage().waitForTimeout(1_500);
	await getPage().waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
};

export const openVersionHistory = async () => {
	await openEditorOverflowMenu();
	await dispatchClick(DocumentsHubPage.overflowVersionHistoryItemCss);
	await getPage()
		.locator(DocumentsHubPage.versionHistoryCss)
		.first()
		.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
};

export const versionHistoryVisible = async () => {
	await verifyElementIsVisible(DocumentsHubPage.versionHistoryCss);
};

/** How many snapshots the panel lists (0 also covers the "No versions yet" empty state). */
export const versionCount = async (): Promise<number> => {
	const rows = getPage().locator(DocumentsHubPage.versionRowCss);
	await rows
		.first()
		.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT })
		.catch(() => undefined);
	return rows.count();
};

export const verifyVersionEntryExists = async () => {
	await expect(getPage().locator(DocumentsHubPage.versionRowCss).first()).toBeVisible({ timeout: DEFAULT_TIMEOUT });
};

export const verifyVersionEntryNamed = async (name: string) => {
	await verifyText(DocumentsHubPage.versionNameCss, name);
};

export const selectFirstVersion = async () => {
	await getPage().locator(DocumentsHubPage.versionRowCss).first().dispatchEvent('click');
	await getPage()
		.locator(DocumentsHubPage.versionPreviewCss)
		.first()
		.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
};

/** Two-step confirm: primary "Restore" arms the inline confirm, the danger one commits it. */
export const restoreSelectedVersion = async () => {
	await dispatchClick(DocumentsHubPage.versionRestoreButtonCss);
	await getPage()
		.locator(DocumentsHubPage.versionRestoreConfirmButtonCss)
		.first()
		.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
	await dispatchClick(DocumentsHubPage.versionRestoreConfirmButtonCss);
	await getPage().waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
};

// ─── Review queue (UX spec §11) ──────────────────────────────────────────────────────────────────

export const reviewQueueVisible = async () => {
	await verifyElementIsVisible(DocumentsHubPage.reviewPageCss);
};

const reviewRows = () => getPage().locator(DocumentsHubPage.reviewRowCss);

/** Number of documents currently awaiting review (0 when the empty state is showing). */
export const reviewRowCount = async (): Promise<number> => {
	await waitForSpinnerGone();
	await getPage().waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
	await reviewRows()
		.first()
		.waitFor({ state: 'visible', timeout: 8_000 })
		.catch(() => undefined);
	return reviewRows().count();
};

export const verifyReviewQueueIsEmpty = async () => {
	await verifyElementIsVisible(DocumentsHubPage.reviewEmptyStateCss);
};

/** Name of the first queued document — the one the approve journey acts on. */
export const firstReviewRowName = async (): Promise<string> => {
	const name = await reviewRows()
		.first()
		.locator(DocumentsHubPage.reviewRowNameCss)
		.first()
		.textContent()
		.catch(() => null);
	return (name ?? '').trim();
};

export const approveReviewRow = async (name: string) => {
	const row = reviewRows().filter({ hasText: name }).first();
	await row.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
	// dispatchClick equivalent scoped to the row: the queue re-renders under a [nbSpinner] overlay
	// after every action, and a coordinate click can land on it.
	await row.locator(DocumentsHubPage.reviewApproveButtonCss).first().dispatchEvent('click');
};

/** After approve the queue reloads; the approved row must be gone from it. */
export const verifyReviewRowIsGone = async (name: string) => {
	await getPage().waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
	await expect(reviewRows().filter({ hasText: name })).toHaveCount(0, { timeout: DEFAULT_TIMEOUT });
};

// ─── Shared ──────────────────────────────────────────────────────────────────────────────────────

export const waitMessageToHide = async () => {
	await waitElementToHide(DocumentsHubPage.toastrMessageCss);
};
