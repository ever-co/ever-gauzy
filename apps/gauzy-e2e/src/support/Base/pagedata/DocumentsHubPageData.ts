/**
 * Test data for the Documents hub journeys (`specs/documents/10-implementation-plan.md` §8.3).
 *
 * Names here are BASE names only — every journey appends a per-run unique suffix (see
 * `documents-hub.steps.ts`). The suite runs serially against ONE accumulating database, so a fixed
 * name would make "my row exists" satisfiable by a leftover row from an earlier run and
 * "my row is gone" impossible to assert. Same reasoning as `OrganizationDocumentsPageData`'s consumer.
 */
export const DocumentsHubPageData = {
	/** Route of the hub shell (hash router). */
	route: '/#/pages/documents',
	/** Route of the review queue (child of the shell). */
	reviewRoute: '/#/pages/documents/review',

	// ── Upload journey ───────────────────────────────────────────────────────────────────────────
	/** Base name of the uploaded file; `.txt` is on the client + server extension allowlist. */
	uploadFileBaseName: 'gauzy-e2e-document',
	uploadFileExtension: '.txt',
	uploadFileMimeType: 'text/plain',
	/**
	 * File body. Plain UTF-8 text so the server's magic-byte sniffer canonicalises it to text/plain
	 * (a mismatch would be REJECTED at the upload endpoint, never reaching the processing pipeline)
	 * and the extractor has something real to turn into markdown.
	 */
	uploadFileContent: [
		'# Ever Gauzy e2e document',
		'',
		'This file is uploaded by the Playwright Documents-hub journey.',
		'It exists so the extraction pipeline has real text to process.'
	].join('\n'),

	// ── Page-editor journey ──────────────────────────────────────────────────────────────────────
	/** Base name of the PAGE document created through the "New page" dialog. */
	pageBaseName: 'E2E hub page',
	/** Body typed into the rich (TipTap) editor. */
	pageBodyText: 'Playwright typed this paragraph into the Documents hub page editor.',

	// ── Timeouts (ms) ────────────────────────────────────────────────────────────────────────────
	/**
	 * How long a freshly uploaded document may stay UPLOADED/PROCESSING before the journey stops
	 * waiting. The client re-polls every DOCS_PROCESSING_POLL_MS (5 s), so this is ~12 poll ticks.
	 * Reaching READY is soft-asserted, never fatal: extraction runs in a background worker that may
	 * not be provisioned on a CI shard, and the rest of the journey (browse → detail) does not
	 * depend on the terminal status.
	 */
	processingTimeout: 60_000,
	/** The page editor is a lazily loaded chunk (spec 05 §12) — first paint is slow on CI. */
	editorLoadTimeout: 60_000,
	/** Bounded wait used by the availability guard before a scenario decides to skip. */
	availabilityTimeout: 15_000
};
