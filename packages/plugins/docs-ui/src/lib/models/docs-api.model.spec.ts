import {
	DocumentKindEnum,
	DocumentReviewStatusEnum,
	DocumentStatusEnum,
	DocumentVisibilityEnum
} from '@gauzy/contracts';
import {
	DOCUMENT_MAX_TAKE,
	normalizeDocumentFacets,
	normalizeDocumentStorage,
	toDocumentsQueryParams
} from './docs-api.model';

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
		it('keeps a selection as the array the DTO accepts (CSV/repeated params)', () => {
			expect(toDocumentsQueryParams({ ...scope, kind: [DocumentKindEnum.PAGE] }).kind).toEqual([
				DocumentKindEnum.PAGE
			]);
		});

		it('keeps a multi-kind selection — dropping it silently widened the result set', () => {
			const params = toDocumentsQueryParams({
				...scope,
				kind: [DocumentKindEnum.PAGE, DocumentKindEnum.FILE]
			});

			expect(params.kind).toEqual([DocumentKindEnum.PAGE, DocumentKindEnum.FILE]);
		});

		it('wraps a scalar caller value into the array shape', () => {
			expect(toDocumentsQueryParams({ ...scope, kind: DocumentKindEnum.FILE }).kind).toEqual([
				DocumentKindEnum.FILE
			]);
		});

		it('omits an empty selection entirely', () => {
			expect(toDocumentsQueryParams({ ...scope, kind: [] })).not.toHaveProperty('kind');
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

/**
 * `normalizeDocumentFacets()` is the seam between the facets endpoint's wire
 * shape and the filter bar.
 *
 * 🛑 The backend answers enum facets as `Record<value, count>` maps and
 * categories/tags as `{ id, name, count }` rows (`DocumentService.getDocumentFacets`);
 * the UI consumes `{ value, label, count }[]` buckets. The response used to be
 * stored raw, so `bucketsOrEnum()` saw a non-array for every enum facet (counts
 * never rendered) and Category/Tag options bound `value: undefined`.
 */
describe('normalizeDocumentFacets — GET /documents/facets wire shape', () => {
	it('maps enum Record facets into { value, count } buckets', () => {
		const facets = normalizeDocumentFacets({
			kind: { FOLDER: 3, FILE: 12 },
			status: { READY: 10, PROCESSING: 2 }
		});

		expect(facets.kind).toEqual([
			{ value: 'FOLDER', count: 3 },
			{ value: 'FILE', count: 12 }
		]);
		expect(facets.status).toEqual([
			{ value: 'READY', count: 10 },
			{ value: 'PROCESSING', count: 2 }
		]);
	});

	it('maps category/tag { id, name, count } rows into { value, label, count } buckets', () => {
		const facets = normalizeDocumentFacets({
			tags: [{ id: 'tag-1', name: 'Legal', count: 4 }],
			categories: [{ id: 'cat-1', name: 'Invoices', count: 7 }]
		});

		expect(facets.tags).toEqual([{ value: 'tag-1', label: 'Legal', count: 4 }]);
		expect(facets.categories).toEqual([{ value: 'cat-1', label: 'Invoices', count: 7 }]);
	});

	it('passes already-bucketed arrays and the presets block through untouched', () => {
		const kind = [{ value: 'PAGE', count: 5 }];
		const presets = { all: 20, needsReview: 3, notInKnowledge: 2, archived: 1 };
		const facets = normalizeDocumentFacets({ kind, presets });

		expect(facets.kind).toBe(kind);
		expect(facets.presets).toBe(presets);
	});

	it('normalizes an empty/absent response to empty buckets (never undefined)', () => {
		const facets = normalizeDocumentFacets(null);

		expect(facets.kind).toEqual([]);
		expect(facets.status).toEqual([]);
		expect(facets.categories).toEqual([]);
		expect(facets.tags).toEqual([]);
		expect(facets.presets).toBeUndefined();
	});
});

/**
 * `normalizeDocumentStorage()` is the seam between the settings endpoint's wire
 * shape and the storage-usage card.
 *
 * 🛑 The server answers `{ defaults, capabilities, quota }`
 * (`DocumentSettingsService.getSettings()`); this function used to read only a
 * `storage` key that the server has never sent, so `storage` was always `null` and
 * the meter was `*ngIf`'d out on every deployment. The `quota` case below is that
 * regression — the other two shapes stay covered because they were the documented
 * tolerance and dropping them would be a silent narrowing.
 */
describe('normalizeDocumentStorage — GET /settings usage block', () => {
	const capabilities = {
		aiEnabled: true,
		vectorSearch: true,
		embeddingModel: 'text-embedding-3-small',
		maxFileSize: 50 * 1024 * 1024,
		acceptedTypes: ['pdf']
	};
	const defaults = {
		importToKnowledgeDefault: false,
		defaultVisibility: DocumentVisibilityEnum.ORGANIZATION,
		autoClassify: true
	};

	it('reads the `quota` block the server actually emits', () => {
		expect(
			normalizeDocumentStorage({
				defaults,
				capabilities,
				quota: { quotaBytes: 1000, usedBytes: 250, remainingBytes: 750, unlimited: false }
			})
		).toEqual({ usedBytes: 250, quotaBytes: 1000 });
	});

	it('treats a zero quota as unlimited rather than as a full bar', () => {
		expect(
			normalizeDocumentStorage({
				defaults,
				capabilities,
				quota: { quotaBytes: 0, usedBytes: 42, remainingBytes: null, unlimited: true }
			})
		).toEqual({ usedBytes: 42, quotaBytes: null });
	});

	it('still accepts the `storage` alias and the flattened capabilities variant', () => {
		expect(
			normalizeDocumentStorage({ defaults, capabilities, storage: { usedBytes: 7, quotaBytes: 70 } })
		).toEqual({ usedBytes: 7, quotaBytes: 70 });

		expect(
			normalizeDocumentStorage({
				defaults,
				capabilities: { ...capabilities, storageUsedBytes: 9, storageQuotaBytes: 90 } as never
			})
		).toEqual({ usedBytes: 9, quotaBytes: 90 });
	});

	it('prefers `quota` when a response carries both blocks', () => {
		expect(
			normalizeDocumentStorage({
				defaults,
				capabilities,
				quota: { quotaBytes: 100, usedBytes: 10, remainingBytes: 90, unlimited: false },
				storage: { usedBytes: 999, quotaBytes: 999 }
			})
		).toEqual({ usedBytes: 10, quotaBytes: 100 });
	});

	it('returns null when the deployment reports no usage at all', () => {
		expect(normalizeDocumentStorage(null)).toBeNull();
		expect(normalizeDocumentStorage({ defaults, capabilities })).toBeNull();
	});
});
