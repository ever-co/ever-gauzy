import { DOCS_PAGE_FULL_VIEW, documentPageLayoutOf } from './document-page-view';

/**
 * A sidebar favorite opens a document page "at max width, keeping only the narrow ALL DOCUMENTS tree on the
 * left" (owner, 2026-10-13, handover §4.P) — for that entry point only: normal Documents navigation keeps the
 * editor's usual width and its right rail.
 */
describe('document page layout by entry point', () => {
	it('opens a favorite (`?view=full`) as wide as the shell allows, with the right rail closed', () => {
		expect(documentPageLayoutOf(DOCS_PAGE_FULL_VIEW)).toEqual({ fullWidth: true, railOpen: false });
		expect(DOCS_PAGE_FULL_VIEW).toBe('full');
	});

	it('leaves every other entry point to the editor defaults', () => {
		expect(documentPageLayoutOf(null)).toBeNull();
		expect(documentPageLayoutOf('')).toBeNull();
		expect(documentPageLayoutOf('narrow')).toBeNull();
	});
});
