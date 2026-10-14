import {
	DEFAULT_DOCUMENT_PAGE_LAYOUT,
	DOCS_PAGE_FULL_VIEW,
	documentPageLayoutOf,
	documentPageLayoutOnViewChange,
	documentPageLayouts,
	IDocumentPageLayout,
	IDocumentPageNavigation
} from './document-page-view';
import { Subject } from 'rxjs';

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

/** The layouts the reused page applies as the viewer moves between documents. */
describe('document page layout across navigations of the reused page', () => {
	const FULL = { fullWidth: true, railOpen: false };
	let navigations: Subject<IDocumentPageNavigation>;
	let applied: IDocumentPageLayout[];

	beforeEach(() => {
		navigations = new Subject();
		applied = [];
		documentPageLayouts(navigations).subscribe((layout) => applied.push(layout));
	});

	const open = (id: string, view: string | null = null) => navigations.next({ id, view });

	/*
	 * Review on #10589: open favorite A, narrow it or open its rail, then open favorite B — both links carry
	 * `view=full`, so a stream keyed on the parameter alone skipped B and the page kept A's layout.
	 */
	it('re-applies the full view when another favorite opens on the reused page', () => {
		open('a', DOCS_PAGE_FULL_VIEW);
		open('b', DOCS_PAGE_FULL_VIEW);

		expect(applied).toEqual([FULL, FULL]);
	});

	it("leaves the viewer's toggles alone while the same favorite stays open", () => {
		open('a', DOCS_PAGE_FULL_VIEW);
		open('a', DOCS_PAGE_FULL_VIEW);

		expect(applied).toEqual([FULL]);
	});

	it('restores the defaults once, when normal navigation leaves the full view', () => {
		open('a', DOCS_PAGE_FULL_VIEW);
		open('b');
		open('c');

		expect(applied).toEqual([FULL, DEFAULT_DOCUMENT_PAGE_LAYOUT]);
	});

	it('never lays out a page opened by normal navigation', () => {
		open('a');
		open('b');

		expect(applied).toEqual([]);
	});
});
