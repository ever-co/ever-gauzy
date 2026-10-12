/**
 * `@gauzy/core` is a barrel over the whole server core — importing it for real pulls the ORM
 * bootstrap, the request context and every entity into the test runtime. Only the two shapes this
 * service actually uses matter here, so stubs stand in: a minimal CRUD base class and a
 * `sanitizeRichHtml` double. The real allowlist has its own coverage in
 * `packages/core/src/lib/core/html-sanitizer/rich-html-sanitizer.spec.ts`; what is under test here
 * is the READ path — that the service runs the corpus through the allowlist at all, and heals the
 * stored row exactly once.
 */
jest.mock('@gauzy/core', () => ({
	TenantAwareCrudService: class TenantAwareCrudService {
		// Set per test; the project-articles query branches on it
		ormType = 'typeorm';
		constructor(public readonly typeOrmRepository: any, public readonly mikroOrmRepository: any) {}
		async find(): Promise<any[]> {
			return [];
		}
		assertRelationsPermitted() {}
	},
	MultiORMEnum: { TypeORM: 'typeorm', MikroORM: 'mikro-orm' },
	RequestContext: { currentTenantId: () => 'tenant-1', currentEmployeeId: () => 'employee-1' },
	parseFindOptionsRelations: (value: any) => value,
	parseFindOptionsSelect: (value: any) => value,
	prepareSQLQuery: (value: string) => value,
	LIKE_OPERATOR: 'ILIKE',
	// 🛑 Returns a FIXED string; it deliberately does not attempt to strip anything.
	//
	// This double previously faked the allowlist with `html.replace(/<script...>/gi, '')`. That is
	// the exact shape of an unsafe sanitizer — CodeQL flagged it as "Incomplete multi-character
	// sanitization" and "Bad HTML filtering regexp", correctly: `</script >` walks straight
	// through it. Even in a test it is worth nothing and worth copying, which is the danger.
	//
	// Returning a constant proves what this suite is actually about — that the READ path delegates
	// to the allowlist and heals the row exactly once — without re-implementing sanitization. The
	// real policy is covered by `packages/core/src/lib/core/html-sanitizer/rich-html-sanitizer.spec.ts`.
	sanitizeRichHtml: jest.fn(() => '<p>hello</p>')
}));

jest.mock('./help-center-article.entity', () => ({ HelpCenterArticle: class HelpCenterArticle {} }));
jest.mock('./help-center-article-version.entity', () => ({
	HelpCenterArticleVersion: class HelpCenterArticleVersion {}
}));
jest.mock('./help-center-article-version.service', () => ({
	HelpCenterArticleVersionService: class HelpCenterArticleVersionService {}
}));
jest.mock('./repository/type-orm-help-center-article.repository', () => ({
	TypeOrmHelpCenterArticleRepository: class TypeOrmHelpCenterArticleRepository {}
}));
jest.mock('./repository/mikro-orm-help-center-article.repository', () => ({
	MikroOrmHelpCenterArticleRepository: class MikroOrmHelpCenterArticleRepository {}
}));

import { ID } from '@gauzy/contracts';
import { HelpCenterArticleService } from './help-center-article.service';

const CATEGORY_ID = 'cccccccc-1111-4111-8111-111111111111' as ID;
const DIRTY_ID = 'aaaaaaaa-1111-4111-8111-111111111111' as ID;
const CLEAN_ID = 'aaaaaaaa-2222-4222-8222-222222222222' as ID;

const DIRTY_HTML = '<p>hello</p><script>alert(1)</script>';
const CLEAN_HTML = '<p>hello</p>';

/**
 * Builds the service with per-test doubles. `find` is the only base-class call the read path makes,
 * so it is stubbed straight onto the instance.
 */
function createService(rows: any[]) {
	const typeOrmRepository = { update: jest.fn(async () => undefined) };
	const mikroOrmRepository = {};
	const versionService = {} as any;

	const service = new HelpCenterArticleService(typeOrmRepository as any, mikroOrmRepository as any, versionService);
	jest.spyOn(service as any, 'find').mockResolvedValue(rows);

	return { service, typeOrmRepository };
}

describe('HelpCenterArticleService — legacy `data` read path', () => {
	beforeEach(() => jest.clearAllMocks());

	it('sanitizes article HTML on the way out of getArticlesByCategoryId', async () => {
		const { service } = createService([{ id: DIRTY_ID, data: DIRTY_HTML }]);

		const [article] = await service.getArticlesByCategoryId(CATEGORY_ID);

		expect(article.data).toBe(CLEAN_HTML);
		expect(article.data).not.toContain('<script');
	});

	it('lazily re-saves the cleaned HTML for rows the allowlist actually changed', async () => {
		const { service, typeOrmRepository } = createService([{ id: DIRTY_ID, data: DIRTY_HTML }]);

		await service.getArticlesByCategoryId(CATEGORY_ID);

		expect(typeOrmRepository.update).toHaveBeenCalledTimes(1);
		expect(typeOrmRepository.update).toHaveBeenCalledWith(DIRTY_ID, { data: CLEAN_HTML });
	});

	it('never re-writes a row that was already clean', async () => {
		const { service, typeOrmRepository } = createService([{ id: CLEAN_ID, data: CLEAN_HTML }]);

		const [article] = await service.getArticlesByCategoryId(CATEGORY_ID);

		expect(article.data).toBe(CLEAN_HTML);
		expect(typeOrmRepository.update).not.toHaveBeenCalled();
	});

	it('leaves rows with no `data` untouched', async () => {
		const { service, typeOrmRepository } = createService([{ id: CLEAN_ID, data: null }]);

		const [article] = await service.getArticlesByCategoryId(CATEGORY_ID);

		expect(article.data).toBeNull();
		expect(typeOrmRepository.update).not.toHaveBeenCalled();
	});

	it('still returns sanitized content when the lazy re-save fails', async () => {
		const { service, typeOrmRepository } = createService([{ id: DIRTY_ID, data: DIRTY_HTML }]);
		typeOrmRepository.update.mockRejectedValue(new Error('db down'));
		jest.spyOn(console, 'error').mockImplementation(() => undefined);

		const [article] = await service.getArticlesByCategoryId(CATEGORY_ID);

		expect(article.data).toBe(CLEAN_HTML);
	});
});

type Row = Record<string, unknown>;

/**
 * Minimal knex stand-in over an in-memory `knowledge_base_article` table: `andWhere` / `whereNull`
 * filters are applied for real (the project sub-query is treated as matching every row), `clone()`
 * copies the filters for the count query, and `select` returns the filtered rows.
 */
function createKnex(rows: Row[]) {
	const column = (name: string) => name.replace(/^kba\./, '');
	const build = (filters: ((row: Row) => boolean)[]) => {
		const matching = () => rows.filter((row) => filters.every((filter) => filter(row)));
		const builder: Record<string, jest.Mock> = {
			whereIn: jest.fn(() => builder),
			andWhere: jest.fn((name: string, value: unknown) => {
				filters.push((row) => row[column(name)] === value);
				return builder;
			}),
			whereNull: jest.fn((name: string) => {
				filters.push((row) => row[column(name)] === null || row[column(name)] === undefined);
				return builder;
			}),
			orderBy: jest.fn(() => builder),
			limit: jest.fn(() => builder),
			offset: jest.fn(() => builder),
			clone: jest.fn(() => build([...filters])),
			clearSelect: jest.fn(() => builder),
			clearOrder: jest.fn(() => builder),
			count: jest.fn(() => builder),
			// Drivers return the count as a string
			first: jest.fn(async () => ({ count: String(matching().length) })),
			select: jest.fn(async () => matching())
		};
		return builder;
	};
	const base = build([]);
	return { knex: jest.fn(() => base), base };
}

describe('HelpCenterArticleService.getArticlesByProjectId (MikroORM)', () => {
	it('excludes soft-deleted articles from the items and the total', async () => {
		const { knex, base } = createKnex([
			{ id: 'a-1', organizationId: 'org-1', tenantId: 'tenant-1', deletedAt: null },
			{ id: 'a-2', organizationId: 'org-1', tenantId: 'tenant-1', deletedAt: null },
			{ id: 'a-3', organizationId: 'org-1', tenantId: 'tenant-1', deletedAt: new Date('2026-01-01') },
			{ id: 'a-4', organizationId: 'org-1', tenantId: 'other-tenant', deletedAt: null }
		]);
		const mikroOrmRepository = { getKnex: () => knex, map: (row: unknown) => row };
		const service = new HelpCenterArticleService({} as any, mikroOrmRepository as any, {} as any);
		(service as any).ormType = 'mikro-orm';

		const { items, total } = await service.getArticlesByProjectId('project-1' as ID, {
			where: { organizationId: 'org-1' }
		} as any);

		expect(items.map((article) => article.id)).toEqual(['a-1', 'a-2']);
		expect(total).toBe(2);
		// The filter is on the base query, so the cloned count query inherits it
		expect(base.whereNull.mock.invocationCallOrder[0]).toBeLessThan(base.clone.mock.invocationCallOrder[0]);
	});
});
