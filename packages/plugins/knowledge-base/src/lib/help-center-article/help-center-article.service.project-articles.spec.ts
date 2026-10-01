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

/**
 * Records the knex calls made on the base query. The count query is a `clone()` of it, so whatever
 * the base query filters on, the total filters on too.
 */
function createKnex() {
	const calls: { method: string; args: unknown[] }[] = [];
	const record = (method: string) =>
		jest.fn((...args: unknown[]) => {
			calls.push({ method, args });
			return builder;
		});
	const countQuery: Record<string, jest.Mock> = {
		clearSelect: jest.fn(() => countQuery),
		clearOrder: jest.fn(() => countQuery),
		count: jest.fn(() => countQuery),
		first: jest.fn(async () => ({ count: '0' }))
	};
	const builder: Record<string, jest.Mock> = {
		whereIn: record('whereIn'),
		andWhere: record('andWhere'),
		whereNull: record('whereNull'),
		orderBy: record('orderBy'),
		limit: record('limit'),
		offset: record('offset'),
		clone: jest.fn(() => countQuery),
		select: jest.fn(async () => [])
	};
	return { knex: jest.fn(() => builder), calls, builder };
}

describe('HelpCenterArticleService.getArticlesByProjectId (MikroORM)', () => {
	it('excludes soft-deleted articles from the items and the total', async () => {
		const { knex, calls, builder } = createKnex();
		const mikroOrmRepository = { getKnex: () => knex, map: (row: unknown) => row };
		const service = new HelpCenterArticleService({} as any, mikroOrmRepository as any, {} as any);

		await service.getArticlesByProjectId('project-1' as ID, { where: { organizationId: 'org-1' } } as any);

		expect(builder.whereNull).toHaveBeenCalledWith('kba.deletedAt');
		// Applied on the base query, before it is cloned for the count
		const cloneOrder = builder.clone.mock.invocationCallOrder[0];
		expect(builder.whereNull.mock.invocationCallOrder[0]).toBeLessThan(cloneOrder);
		expect(calls.some(({ method, args }) => method === 'andWhere' && args[0] === 'kba.tenantId')).toBe(true);
	});
});
