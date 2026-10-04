/**
 * `@gauzy/core` is stubbed as in `help-center-article.service.spec.ts`: only the shapes this service
 * uses are provided, here with the MikroORM branch selected.
 */
jest.mock('@gauzy/core', () => ({
	TenantAwareCrudService: class TenantAwareCrudService {
		constructor(public readonly typeOrmRepository: any, public readonly mikroOrmRepository: any) {}
		get ormType() {
			return 'mikro-orm';
		}
		assertRelationsPermitted() {}
	},
	MultiORMEnum: { TypeORM: 'typeorm', MikroORM: 'mikro-orm' },
	RequestContext: { currentTenantId: () => 'tenant-1', currentEmployeeId: () => 'employee-1' },
	parseFindOptionsRelations: (value: any) => value,
	parseFindOptionsSelect: (value: any) => value,
	prepareSQLQuery: (value: string) => value,
	LIKE_OPERATOR: 'ILIKE',
	sanitizeRichHtml: jest.fn((html: string) => html)
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

		const { items, total } = await service.getArticlesByProjectId('project-1' as ID, {
			where: { organizationId: 'org-1' }
		} as any);

		expect(items.map((article: { id: string }) => article.id)).toEqual(['a-1', 'a-2']);
		expect(total).toBe(2);
		// The filter is on the base query, so the cloned count query inherits it
		expect(base.whereNull.mock.invocationCallOrder[0]).toBeLessThan(base.clone.mock.invocationCallOrder[0]);
	});
});
