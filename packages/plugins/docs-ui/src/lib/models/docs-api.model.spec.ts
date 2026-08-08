import {
	DocumentKindEnum,
	DocumentReviewStatusEnum,
	DocumentStatusEnum,
	DocumentVisibilityEnum
} from '@gauzy/contracts';
import { DOCUMENT_MAX_TAKE, toDocumentsQueryParams } from './docs-api.model';

/**
 * `toDocumentsQueryParams()` is the single reconciliation point between the hub's
 * filter state and `GetDocumentsQueryDTO`
 * (`packages/plugins/docs/src/lib/dto/get-documents-query.dto.ts`).
 *
 * Every assertion here mirrors a decorator on that DTO. The endpoints validate
 * with `whitelist: true`, which splits failures in two:
 *
 * - a **known** param with the wrong shape (boolean `archived`, composite `sort`,
 *   array `kind`) is a 400 — the list, the count and the facets all fail, so the
 *   hub can never render a single row; and
 * - an **unknown** param (`createdFrom`, a top-level `organizationId`) is stripped in
 *   silence — the filter simply stops filtering, which is worse than an error
 *   because it looks like it works.
 */
describe('toDocumentsQueryParams — GetDocumentsQueryDTO reconciliation', () => {
	const ORG = 'e4a3b0a0-1111-4111-8111-111111111111';
	const TENANT = 'e4a3b0a0-2222-4222-8222-222222222222';
	const scope = { organizationId: ORG, tenantId: TENANT };

	describe('archived', () => {
		it('maps the boolean onto the DTO enum (@IsIn([exclude, include, only]))', () => {
			expect(toDocumentsQueryParams({ ...scope, archived: false }).archived).toBe('exclude');
			expect(toDocumentsQueryParams({ ...scope, archived: true }).archived).toBe('only');
		});

		it('passes an enum value through and drops an unknown one', () => {
			expect(toDocumentsQueryParams({ ...scope, archived: 'include' }).archived).toBe('include');
			expect(toDocumentsQueryParams({ ...scope, archived: 'yes' as never }).archived).toBeUndefined();
		});

		it('never emits a boolean', () => {
			const params = toDocumentsQueryParams({ ...scope, archived: true });

			expect(typeof params.archived).toBe('string');
		});
	});

	describe('sort', () => {
		it('splits a composite `field:order` into the two DTO params', () => {
			const params = toDocumentsQueryParams({ ...scope, sort: 'updatedAt:desc' });

			expect(params.sort).toBe('updatedAt');
			expect(params.sortOrder).toBe('DESC');
			expect(String(params.sort)).not.toContain(':');
		});

		it('accepts the `{ field, order }` shape the browse filter state uses', () => {
			const params = toDocumentsQueryParams({ ...scope, sort: { field: 'name', order: 'ASC' } });

			expect(params).toMatchObject({ sort: 'name', sortOrder: 'ASC' });
		});

		it('drops a field outside the DTO allowlist (`index` would be a 400)', () => {
			const params = toDocumentsQueryParams({ ...scope, sort: 'index:asc' });

			expect(params.sort).toBeUndefined();
			expect(params.sortOrder).toBeUndefined();
		});
	});

	describe('kind', () => {
		it('unwraps a single-element array into the DTO scalar', () => {
			expect(toDocumentsQueryParams({ ...scope, kind: [DocumentKindEnum.PAGE] }).kind).toBe(DocumentKindEnum.PAGE);
		});

		it('drops a multi-kind selection the scalar DTO cannot express', () => {
			const params = toDocumentsQueryParams({
				...scope,
				kind: [DocumentKindEnum.PAGE, DocumentKindEnum.FILE]
			});

			expect(params.kind).toBeUndefined();
		});
	});

	describe('date ranges', () => {
		it('emits the DTO names, not the URL parameter names', () => {
			const params = toDocumentsQueryParams({
				...scope,
				createdAtFrom: '2026-01-01',
				createdAtTo: '2026-01-31',
				updatedAtFrom: '2026-02-01',
				updatedAtTo: '2026-02-28'
			});

			expect(params).toMatchObject({
				createdAtFrom: '2026-01-01',
				createdAtTo: '2026-01-31',
				updatedAtFrom: '2026-02-01',
				updatedAtTo: '2026-02-28'
			});
			expect(params).not.toHaveProperty('createdFrom');
			expect(params).not.toHaveProperty('updatedTo');
		});
	});

	describe('parentId', () => {
		it('keeps `root` (the top-level browse) verbatim', () => {
			expect(toDocumentsQueryParams({ ...scope, parentId: 'root' }).parentId).toBe('root');
		});

		it('omits a null parent instead of serializing the string "null"', () => {
			const params = toDocumentsQueryParams({ ...scope, parentId: null });

			expect(params).not.toHaveProperty('parentId');
		});
	});

	describe('search', () => {
		it('degrades a too-short content search to a name search instead of a 400', () => {
			const params = toDocumentsQueryParams({ ...scope, q: 'ab', searchIn: 'content' });

			expect(params).toMatchObject({ q: 'ab', searchIn: 'name' });
		});

		it('keeps a content search at the backend minimum length', () => {
			expect(toDocumentsQueryParams({ ...scope, q: 'abc', searchIn: 'content' }).searchIn).toBe('content');
		});

		it('drops a blank query (and its searchIn) entirely', () => {
			const params = toDocumentsQueryParams({ ...scope, q: '   ', searchIn: 'content' });

			expect(params).not.toHaveProperty('q');
			expect(params).not.toHaveProperty('searchIn');
		});
	});

	describe('pagination', () => {
		it('clamps `take` to the DTO maximum (@Max(100))', () => {
			expect(toDocumentsQueryParams({ ...scope, take: 240 }).take).toBe(DOCUMENT_MAX_TAKE);
		});

		it('drops a non-positive window', () => {
			expect(toDocumentsQueryParams({ ...scope, take: 0, skip: 0 })).not.toHaveProperty('take');
			expect(toDocumentsQueryParams({ ...scope, take: 0, skip: 0 })).not.toHaveProperty('skip');
		});
	});

	describe('organization scope', () => {
		it('moves the scope into `where` (BaseQueryDTO.where is @IsNotEmpty)', () => {
			const params = toDocumentsQueryParams({ ...scope });

			expect(params.where).toEqual({ organizationId: ORG, tenantId: TENANT });
			expect(params).not.toHaveProperty('organizationId');
			expect(params).not.toHaveProperty('tenantId');
		});

		it('never emits a tenant-only `where` (TenantOrganizationBaseDTO requires the organization)', () => {
			const params = toDocumentsQueryParams({ tenantId: TENANT });

			expect(params).not.toHaveProperty('where');
		});
	});

	describe('empty values', () => {
		it('omits empty arrays and undefined keys so `toParams` cannot serialize "undefined"', () => {
			const params = toDocumentsQueryParams({
				...scope,
				status: [],
				categoryIds: [],
				tagIds: [],
				relations: []
			});

			expect(Object.keys(params)).toEqual(['where']);
			expect(Object.values(params).every((value) => value !== undefined)).toBe(true);
		});

		it('keeps the filters it can express', () => {
			const params = toDocumentsQueryParams({
				...scope,
				status: [DocumentStatusEnum.READY],
				reviewStatus: [DocumentReviewStatusEnum.PENDING],
				visibility: DocumentVisibilityEnum.PRIVATE,
				searchable: false,
				relations: ['categories', 'tags']
			});

			expect(params).toMatchObject({
				status: [DocumentStatusEnum.READY],
				reviewStatus: [DocumentReviewStatusEnum.PENDING],
				visibility: DocumentVisibilityEnum.PRIVATE,
				searchable: false,
				relations: ['categories', 'tags']
			});
		});
	});
});
