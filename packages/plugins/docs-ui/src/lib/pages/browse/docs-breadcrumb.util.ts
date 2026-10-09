import { ID } from '@gauzy/contracts';
// `import type` on purpose: this module stays pure, so it must not pull the HTTP
// service (and through it the `@gauzy/ui-core/core` barrel) into its consumers.
import type { IDocumentPathSegment } from '../../services/documents.service';

/**
 * One rendered breadcrumb segment.
 *
 * Structurally identical to `IDocsCardsCrumb` (the cards view is where the crumb
 * row originated) and declared separately on purpose: this module is pure, and
 * importing the cards component here would drag an Angular component — and, via
 * its action menu, the whole `@gauzy/ui-core/core` barrel — into every consumer.
 */
export interface IDocsBreadcrumbSegment {
	id: ID | null;
	name: string;
	restricted?: boolean;
}

/**
 * Maps the `GET /documents/:id/path` response onto rendered crumbs.
 *
 * 🛑 Returns `null` — never `[]` — when the response is not usable, because the
 * caller treats `null` as "fall back to the locally cached chain" while an empty
 * array is a legitimate answer (a root-level folder has no ancestors) that must
 * NOT trigger the fallback: the local walk would produce a different, longer
 * trail for the same location.
 *
 * A segment with no `id` is redacted whether or not the server also set the flag
 * (`08-permissions-security.md` §3.2) — there is nothing to navigate to and no
 * name to show, so it is marked `restricted` either way and the template renders
 * `DOCS.BREADCRUMB.RESTRICTED` in its place.
 *
 * The chain is expected to end at `folderId` itself. When the server answers with
 * ancestors only, the current folder is appended from `nameOf` so the trail still
 * shows where the user is standing; if that name cannot be resolved the crumb is
 * left off rather than rendered blank.
 */
export function toDocsBreadcrumb(
	segments: IDocumentPathSegment[] | null | undefined,
	folderId: ID,
	nameOf: (id: ID) => string | undefined
): IDocsBreadcrumbSegment[] | null {
	if (!Array.isArray(segments)) return null;

	const crumbs: IDocsBreadcrumbSegment[] = segments.map((segment) => ({
		id: segment?.id ?? null,
		name: segment?.name ?? '',
		restricted: !!segment?.restricted || !segment?.id
	}));

	const last = crumbs[crumbs.length - 1];
	if (!last || String(last.id ?? '') !== String(folderId)) {
		const name = nameOf(folderId);
		if (name) crumbs.push({ id: folderId, name });
	}
	return crumbs;
}
