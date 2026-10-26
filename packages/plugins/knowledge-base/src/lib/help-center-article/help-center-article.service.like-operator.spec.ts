/**
 * `@gauzy/core` is a barrel over the whole server core; stubs stand in for the shapes this service uses.
 * LIKE_OPERATOR is what core resolves on a non-PostgreSQL database (MySQL / SQLite).
 */
jest.mock('@gauzy/core', () => ({
	TenantAwareCrudService: class TenantAwareCrudService {
		ormType = 'mikro-orm';
		constructor(public readonly typeOrmRepository: any, public readonly mikroOrmRepository: any) {}
		assertRelationsPermitted() {}
		/** The organization boundary that applies to the service right now: none here. */
		organizationBoundary(): any {
			return null;
		}
	},
	MultiORMEnum: { TypeORM: 'typeorm', MikroORM: 'mikro-orm' },
	RequestContext: { currentTenantId: () => 'tenant-1' },
	parseFindOptionsRelations: (value: any) => value,
	parseFindOptionsSelect: (value: any) => value,
	prepareSQLQuery: (value: string) => value,
	LIKE_OPERATOR: 'LIKE',
	sanitizeRichHtml: (value: string) => value
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
 * The MikroORM (Knex) arm filtered by name with a literal `ILIKE`, which only PostgreSQL knows, while the
 * TypeORM arm already used LIKE_OPERATOR.
 */
describe('HelpCenterArticleService.getArticlesByProjectId (MikroORM) name filter', () => {
	it('uses LIKE_OPERATOR rather than a hard-coded ILIKE', async () => {
		const builder: any = {
			whereIn: jest.fn(() => builder),
			andWhere: jest.fn(() => builder),
			whereNull: jest.fn(() => builder),
			orderBy: jest.fn(() => builder),
			limit: jest.fn(() => builder),
			offset: jest.fn(() => builder),
			clone: jest.fn(() => builder),
			clearSelect: jest.fn(() => builder),
			clearOrder: jest.fn(() => builder),
			count: jest.fn(() => builder),
			first: jest.fn(async () => ({ count: '0' })),
			select: jest.fn(async () => [])
		};
		const mikroOrmRepository = { getKnex: () => jest.fn(() => builder), map: (row: unknown) => row };
		const service = new HelpCenterArticleService({} as any, mikroOrmRepository as any, {} as any);

		await service.getArticlesByProjectId('project-1' as ID, {
			where: { organizationId: 'org-1', name: 'guide' }
		} as any);

		expect(builder.andWhere).toHaveBeenCalledWith('kba.name', 'LIKE', '%guide%');
		expect(builder.andWhere).not.toHaveBeenCalledWith('kba.name', 'ILIKE', expect.anything());
	});
});
