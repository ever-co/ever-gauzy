/**
 * `?view=full` on `/pages/documents/page/:id` — how a sidebar favorite opens a document page: "at max
 * width, keeping only the narrow ALL DOCUMENTS tree on the left" (owner, 2026-10-13, handover §4.P). The
 * favorite link builder (`ENTITY_LINKS` in `@gauzy/ui-core/core`) writes the same value; normal Documents
 * navigation carries no `view` and keeps the editor's defaults.
 */
export const DOCS_PAGE_FULL_VIEW = 'full';

export interface IDocumentPageLayout {
	fullWidth: boolean;
	railOpen: boolean;
}

/** The layout the `view` query parameter asks for, or null to keep the editor's defaults. */
export function documentPageLayoutOf(view: string | null | undefined): IDocumentPageLayout | null {
	return view === DOCS_PAGE_FULL_VIEW ? { fullWidth: true, railOpen: false } : null;
}
