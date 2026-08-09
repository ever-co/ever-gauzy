/**
 * P0 regression: `GET /documents/:readableId?relations=children` handed back every child of a
 * readable folder — other people's PRIVATE pages included, with `contentJson`/`contentHtml` in
 * full. `toRelationList()` passed whatever the client asked for straight into `findOne()`, and the
 * row-level gate only ever ran on the top-level document (`08-permissions-security.md` §3.4 row 6).
 *
 * The controller half of the fix is an allowlist. `children` must stay out of it: child listing has
 * its own scoped route (`GET /documents?parentId=<id>`), which applies the visibility predicate in
 * SQL. The service half (masking whatever IS joined) is pinned in `document-scope.spec.ts`.
 *
 * `@gauzy/core` boots the whole application graph on import, so the decorator seams are stubbed at
 * the module boundary; the function under test is the real one.
 */
jest.mock('@gauzy/common', () => ({ FeatureFlag: () => () => undefined }), { virtual: true });
jest.mock(
	'@gauzy/core',
	() => ({
		FeatureFlagGuard: class {},
		PermissionGuard: class {},
		Permissions: () => () => undefined,
		TenantPermissionGuard: class {},
		UseValidationPipe: () => () => undefined,
		UUIDValidationPipe: class {}
	}),
	{ virtual: true }
);
jest.mock('../entities/document.entity', () => ({ Document: class {} }));
// The DTO classes extend `TenantOrganizationBaseDTO`, which the mock above cannot provide.
jest.mock('../dto', () => ({}));

import { ALLOWED_DOCUMENT_RELATIONS, toRelationList } from './document.controller';

describe('document relations allowlist', () => {
	it('never allows `children` — that is the leak', () => {
		expect(ALLOWED_DOCUMENT_RELATIONS).not.toContain('children');
	});

	it('allows exactly the relations that carry no per-row visibility of their own', () => {
		expect([...ALLOWED_DOCUMENT_RELATIONS].sort()).toEqual([
			'categories',
			'createdByUser',
			'parent',
			'reviewedBy',
			'tags',
			'updatedByUser'
		]);
	});

	it('allows the actor relations the detail panel joins for the Created/Updated rows', () => {
		// Silent-strip seam: the panel asks for these by name (`DOCS_DETAIL_RELATIONS`), and a
		// dropped relation does not error — it degrades both metadata rows to a bare timestamp.
		expect(toRelationList(['createdByUser', 'updatedByUser'])).toEqual(['createdByUser', 'updatedByUser']);
	});

	it('drops `children` from a single-value query parameter', () => {
		expect(toRelationList('children')).toEqual([]);
	});

	it('drops `children` from a repeated query parameter but keeps the allowlisted ones', () => {
		expect(toRelationList(['parent', 'children', 'tags'])).toEqual(['parent', 'tags']);
	});

	it('drops an unknown relation name rather than failing the whole detail request', () => {
		expect(toRelationList(['parent', 'versions', 'shares'])).toEqual(['parent']);
	});

	it('treats an absent value as "no relations"', () => {
		expect(toRelationList()).toEqual([]);
		expect(toRelationList('')).toEqual([]);
	});
});
