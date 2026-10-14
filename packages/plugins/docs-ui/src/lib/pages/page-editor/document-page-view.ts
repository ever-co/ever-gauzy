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

/** The editor's own defaults: its usual width, the right rail open. */
export const DEFAULT_DOCUMENT_PAGE_LAYOUT: IDocumentPageLayout = { fullWidth: false, railOpen: true };

/** The layout the `view` query parameter asks for, or null to keep the editor's defaults. */
export function documentPageLayoutOf(view: string | null | undefined): IDocumentPageLayout | null {
	return view === DOCS_PAGE_FULL_VIEW ? { fullWidth: true, railOpen: false } : null;
}

/**
 * The layout to apply when the `view` parameter changes, given whether the current layout came from it:
 * entering `view=full` applies the full view; leaving it (a breadcrumb, a tree click — normal navigation)
 * restores the defaults, but only when the full view had been applied by the parameter, so the viewer's
 * own toggles on an ordinary page are never overridden. Null: leave the layout as it is.
 */
export function documentPageLayoutOnViewChange(
	view: string | null | undefined,
	appliedByView: boolean
): IDocumentPageLayout | null {
	const requested = documentPageLayoutOf(view);
	if (requested) {
		return requested;
	}
	return appliedByView ? DEFAULT_DOCUMENT_PAGE_LAYOUT : null;
}
