import {
	DEFAULT_DOCUMENT_PAGE_LAYOUT,
	DOCS_PAGE_FULL_VIEW,
	documentPageLayoutOf,
	documentPageLayoutOnViewChange
} from './document-page-view';

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

	/*
	 * Review on #10589: after a favorite opened a page full width, a breadcrumb to another document kept the
	 * full view (the component is reused and the subscription ignored the missing parameter).
	 */
	it('restores the editor defaults when normal navigation leaves the full view', () => {
		expect(documentPageLayoutOnViewChange(null, true)).toEqual(DEFAULT_DOCUMENT_PAGE_LAYOUT);
		expect(DEFAULT_DOCUMENT_PAGE_LAYOUT).toEqual({ fullWidth: false, railOpen: true });
	});

	it("never overrides the viewer's own toggles on a page the parameter did not lay out", () => {
		expect(documentPageLayoutOnViewChange(null, false)).toBeNull();
	});

	it('applies the full view whenever the parameter asks for it', () => {
		expect(documentPageLayoutOnViewChange(DOCS_PAGE_FULL_VIEW, false)).toEqual({
			fullWidth: true,
			railOpen: false
		});
		expect(documentPageLayoutOnViewChange(DOCS_PAGE_FULL_VIEW, true)).toEqual({ fullWidth: true, railOpen: false });
	});
});
