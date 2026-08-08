import { Params } from '@angular/router';

/**
 * One named, device-local saved filter view (`01-ux-spec.md` §5, phased M5).
 *
 * A saved view is *just a stored query string*: the URL is already the single
 * source of truth for the whole browse state (§5.1), so applying a view is a
 * merge-write of `params` over the current query string. That keeps saved views
 * forward-compatible — a param added to §5.1 later is stored automatically, and
 * a param removed from §5.1 is dropped by the existing whitelist parser on
 * restore instead of corrupting the view.
 *
 * 🛑 v1 is **never** server-side. Nothing here is sent to the API.
 */
export interface IDocsSavedView {
	/** Client-generated stable id (also the template `trackBy` key). */
	id: string;
	/** User-supplied label. */
	name: string;
	/**
	 * Canonical §5.1 query-param set captured when the view was saved. Values are
	 * always strings; a param that was at its default is simply absent (so
	 * applying the view still clears it — see `DocsSavedViewsService.toApplyPatch`).
	 */
	params: Params;
	/** ISO timestamp — saved views list newest-first. */
	createdAt: string;
	/** ISO timestamp of the last rename/overwrite. */
	updatedAt?: string;
}

/**
 * Query params a saved view deliberately does NOT capture: they are per-visit
 * navigation state, not a "view".
 *
 * - `id` — which document's detail panel happens to be open
 * - `folder` — tree location (a view is meant to travel across folders)
 * - `page` — paging position
 * - `upload` / `newPage` — one-shot deep links that are stripped on arrival
 */
export const DOCS_SAVED_VIEW_EXCLUDED_PARAMS = ['id', 'folder', 'page', 'upload', 'newPage'] as const;

/**
 * Params a saved view owns. Applying a view must *clear* every one of these that
 * the view does not carry, otherwise a leftover facet from the previous view
 * silently narrows the result set.
 */
export const DOCS_SAVED_VIEW_PARAMS = [
	'q',
	'searchIn',
	'preset',
	'kind',
	'status',
	'knowledge',
	'source',
	'categories',
	'tags',
	'createdFrom',
	'createdTo',
	'updatedFrom',
	'updatedTo',
	'sort',
	'pageSize',
	'view'
] as const;
