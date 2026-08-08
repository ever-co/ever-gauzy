import { Given, Then, When, test } from '../../support/bdd';
import * as documentsHubPage from '../../support/pages/DocumentsHub.po';
import { DocumentsHubPageData } from '../../../src/support/Base/pagedata/DocumentsHubPageData';
import { faker } from '@faker-js/faker';

/**
 * Documents hub end-to-end journeys — `specs/documents/10-implementation-plan.md` §8.3.
 *
 * Authored the same way as every other feature here: one `.feature` Scenario per journey, one step per
 * meaningful user-visible phase, each step body a `.po` call sequence with its verification folded in.
 * The `Given I am logged in as the default user` Background step lives once in `common.steps.ts`.
 *
 * Cross-step state (the names this run generated) is hoisted to module scope and initialised in each
 * scenario's FIRST step — safe because playwright-bdd runs one scenario per test and this suite runs
 * with `workers: 1`.
 *
 * Two deliberate resilience rules, both required by the CI environment rather than by the UI:
 *
 *  1. **AI is off in CI** (`GAUZY_DOCS_AI_ENABLED=false`). Anything downstream of classification — the
 *     AI summary, `aiConfidence`, auto-assigned categories, and whether an upload is auto-flagged for
 *     review at all — is therefore absent by design. Those assertions are SOFT (`expect.soft`, so the
 *     observation is reported without aborting the journey) or skipped outright.
 *  2. **Ingest is asynchronous.** A freshly uploaded FILE is UPLOADED → PROCESSING → READY|FAILED, and
 *     the row refreshes in place on a 5 s poll. The journey waits for that to settle before reading the
 *     status, and never asserts a status it read before the poll could have updated it.
 */

// ─── Per-run unique names ────────────────────────────────────────────────────────────────────────
// The hub grid accumulates across runs (one shared database, serial execution), so fixed names make
// "my row exists" satisfiable by a leftover and "my row is gone" impossible to assert. A unique token
// per run scopes create / search / open / verify to exactly this scenario's document.
let uniqueToken = '';
let uploadedFileName = '';
let pageName = '';
let reviewedDocumentName = '';

const newToken = (): string => faker.string.alphanumeric(6).toLowerCase();

// ─── Background ──────────────────────────────────────────────────────────────────────────────────

Given('the Documents hub is available', async () => {
	const available = await documentsHubPage.isDocumentsHubAvailable();
	// A closed feature flag is an ENVIRONMENT fact, not a regression of what these journeys test — so
	// report it as a skip with its cause rather than as a failure 20 steps downstream on the dashboard
	// redirect that `docsFeatureGuard` issues.
	test.skip(
		!available,
		'Documents hub not available for this account — FEATURE_DOCUMENTS disabled for the organization or DOCS_READ missing'
	);
	await documentsHubPage.navMenuEntryVisible();
});

// ─── Journey 1: upload → browse → detail panel ───────────────────────────────────────────────────

When('I upload a file to the Documents hub', async () => {
	uniqueToken = newToken();
	uploadedFileName = `${DocumentsHubPageData.uploadFileBaseName}-${uniqueToken}${DocumentsHubPageData.uploadFileExtension}`;

	await documentsHubPage.openDocumentsHub();
	await documentsHubPage.shellVisible();
	await documentsHubPage.treeSidebarVisible();
	await documentsHubPage.filterBarVisible();
	await documentsHubPage.presetChipsVisible();

	await documentsHubPage.uploadButtonVisible();
	await documentsHubPage.uploadFiles(
		uploadedFileName,
		DocumentsHubPageData.uploadFileContent,
		DocumentsHubPageData.uploadFileMimeType
	);

	// Post-pick, pre-upload classification dialog (UX spec §7.2). Accept its defaults: with AI disabled
	// the "Classify with AI" toggle is a no-op server-side, and the journey is about the upload path.
	await documentsHubPage.classificationDialogVisible();
	await documentsHubPage.startUpload();

	// Per-file progress rows (UX spec §7.3), then the HTTP upload itself terminating.
	await documentsHubPage.uploadProgressVisible();
	const outcome = await documentsHubPage.waitForUploadToFinish(uploadedFileName);
	if (outcome !== 'done') {
		// Name the real cause here rather than failing on a missing row three steps later.
		throw new Error(
			`Upload of "${uploadedFileName}" ended as "${outcome}": ${await documentsHubPage.uploadErrorText(
				uploadedFileName
			)}`
		);
	}
});

When('I find the uploaded document in the Documents hub list', async () => {
	// Scope the server-paginated grid to this run's row before asserting anything about it.
	await documentsHubPage.searchDocuments(uniqueToken);
	await documentsHubPage.tableVisible();
	await documentsHubPage.verifyDocumentRowExists(uploadedFileName);
	await documentsHubPage.verifyDocumentNameCell(uploadedFileName);

	// Asynchronous ingest: wait out UPLOADED/PROCESSING, then SOFT-assert it reached READY — the
	// extraction worker is an environment dependency and the remaining journey does not need it.
	const status = await documentsHubPage.waitForRowProcessingSettled(uploadedFileName);
	await documentsHubPage.softVerifyProcessingReady(uploadedFileName, status);
});

Then('I can open the uploaded document in the Documents hub detail panel', async () => {
	await documentsHubPage.openDocumentRow(uploadedFileName);
	await documentsHubPage.detailPanelVisible();
	await documentsHubPage.verifyDetailPanelName(uploadedFileName);
	await documentsHubPage.detailBadgesVisible();
	await documentsHubPage.detailMetadataVisible();
	// AI-dependent, therefore soft: no classification run means no summary (UX spec §8 renders
	// "No summary yet" in that case, which is correct behaviour, not a failure).
	await documentsHubPage.softVerifyAiSummaryPresent();
	await documentsHubPage.closeDetailPanel();
	await documentsHubPage.clearSearch();
});

// ─── Journey 2: create page → edit → save → version history ──────────────────────────────────────

When('I create a new page in the Documents hub', async () => {
	uniqueToken = newToken();
	pageName = `${DocumentsHubPageData.pageBaseName} ${uniqueToken}`;

	await documentsHubPage.openDocumentsHub();
	await documentsHubPage.newPageButtonVisible();
	await documentsHubPage.clickNewPageButton();
	await documentsHubPage.createDialogVisible();
	await documentsHubPage.enterCreateName(pageName);
	await documentsHubPage.clickCreateConfirm();

	// Creating a PAGE routes straight into the editor at /pages/documents/page/:id (UX spec §10).
	await documentsHubPage.pageEditorVisible();
	await documentsHubPage.verifyEditorTitle(pageName);
});

When('I write content in the Documents hub page editor', async () => {
	await documentsHubPage.fillPageEditor(DocumentsHubPageData.pageBodyText);
	// Ctrl+S is bound to the autosave flush (never the browser save dialog), so the assertion below
	// does not have to sit through the 2 s debounce.
	await documentsHubPage.flushEditorSave();
	await documentsHubPage.waitForEditorSaved();
	await documentsHubPage.verifyEditorSaveDidNotFail();
});

When('I save a version of the Documents hub page', async () => {
	// "Save version now" (⋯ menu) flushes with forceSnapshot, which ALWAYS writes a DocumentVersion —
	// unlike a plain autosave, where snapshotting is the server's decision. That is what makes the
	// next step deterministic.
	await documentsHubPage.clickSaveVersionNow();
});

Then('the Documents hub version history lists the saved version', async () => {
	await documentsHubPage.openVersionHistory();
	await documentsHubPage.versionHistoryVisible();
	await documentsHubPage.verifyVersionEntryExists();
	await documentsHubPage.verifyVersionEntryNamed(pageName);

	// Restore is the other half of §8.3's "create page → edit → version restore". It is
	// non-destructive by contract (the server snapshots current content first), so it is safe to run
	// against the page this scenario just created.
	await documentsHubPage.selectFirstVersion();
	await documentsHubPage.restoreSelectedVersion();
	await documentsHubPage.verifyVersionEntryExists();
});

// ─── Journey 3: review → approve → visible in the default list ───────────────────────────────────

When('I open the Documents hub review queue', async () => {
	await documentsHubPage.openDocumentsHub();
	await documentsHubPage.clickReviewQueueButton();
	await documentsHubPage.reviewQueueVisible();

	const pending = await documentsHubPage.reviewRowCount();
	if (pending === 0) {
		// Assert the queue's own empty state is correct before bailing out, so this branch still tests
		// something real (UX spec §11 / §13 `review-empty`).
		await documentsHubPage.verifyReviewQueueIsEmpty();
	}
	// Nothing to approve. A document only enters the queue via AI classification (low confidence /
	// AI-generated), a failed extraction, or a chat/email capture — none of which CI produces, since
	// AI is disabled and there is no UI affordance that calls `POST …/review/request`. Skipping states
	// that honestly; going green here would report approval coverage this run did not have.
	test.skip(
		pending === 0,
		'Review queue is empty — nothing lands in review with GAUZY_DOCS_AI_ENABLED=false and no UI path requests review'
	);

	reviewedDocumentName = await documentsHubPage.firstReviewRowName();
	if (!reviewedDocumentName) {
		throw new Error('A review-queue row is present but its name cell is empty — cannot scope the approval');
	}
});

When('I approve the first document waiting for review', async () => {
	await documentsHubPage.approveReviewRow(reviewedDocumentName);
	await documentsHubPage.waitMessageToHide();
	// The queue reloads after an approval; the approved document must have left it.
	await documentsHubPage.verifyReviewRowIsGone(reviewedDocumentName);
});

Then('the approved document appears in the default Documents hub list', async () => {
	await documentsHubPage.openDocumentsHub();
	await documentsHubPage.searchDocuments(reviewedDocumentName);
	await documentsHubPage.verifyDocumentRowExists(reviewedDocumentName);

	// The observable consequence of approval: the detail panel's "needs review" banner is gone.
	// (Its other consequence — the document becoming eligible for AI answers — is a retrieval-gate
	// behaviour with no UI surface here, and is covered by the API tests in §8.2.)
	await documentsHubPage.openDocumentRow(reviewedDocumentName);
	await documentsHubPage.detailPanelVisible();
	await documentsHubPage.verifyDetailPanelName(reviewedDocumentName);
	await documentsHubPage.verifyDetailReviewBannerGone();
	await documentsHubPage.closeDetailPanel();
	await documentsHubPage.clearSearch();
});
