import { distinctUntilChanged, filter, map, Observable, scan } from 'rxjs';

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

/** One navigation of the (reused) document page, as far as its layout is concerned. */
export interface IDocumentPageNavigation {
	id: string;
	view: string | null;
}

/**
 * The layouts a reused document page applies as it is navigated, one per navigation that changes the layout
 * (see `documentPageLayoutOnViewChange`); navigations that leave the layout to the viewer emit nothing.
 *
 * Keyed on the document as well as the parameter: opening a second favorite (another id, the same
 * `view=full`) re-applies the full view the viewer may have toggled away on the first, while toggles made
 * on the open document are kept until the viewer navigates.
 */
export function documentPageLayouts(
	navigations$: Observable<IDocumentPageNavigation>
): Observable<IDocumentPageLayout> {
	return navigations$.pipe(
		distinctUntilChanged((previous, next) => previous.id === next.id && previous.view === next.view),
		scan(
			(state, { view }) => ({
				layout: documentPageLayoutOnViewChange(view, state.appliedByView),
				appliedByView: !!documentPageLayoutOf(view)
			}),
			{ layout: null as IDocumentPageLayout | null, appliedByView: false }
		),
		map((state) => state.layout),
		filter((layout): layout is IDocumentPageLayout => !!layout)
	);
}
