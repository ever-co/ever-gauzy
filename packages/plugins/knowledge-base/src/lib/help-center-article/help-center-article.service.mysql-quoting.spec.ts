/**
 * `@gauzy/core` is a barrel over the whole server core; stubs stand in for the shapes this service uses.
 * `prepareSQLQuery` is stubbed as it behaves on MySQL: every double-quoted identifier becomes back-quoted.
 */
jest.mock('@gauzy/core', () => ({
	TenantAwareCrudService: class TenantAwareCrudService {
		constructor(public readonly typeOrmRepository: any, public readonly mikroOrmRepository: any) {}

		// A caller confined to one organization, for a raw query that also keeps to the organization boundary
		// of the CRUD base (ever-co/ever-gauzy#11314); unused by a query that does not read it.
		organizationBoundary() {
			return { organizationId: 'organization-1' };
		}
	},
	MultiORMEnum: { TypeORM: 'typeorm', MikroORM: 'mikro-orm' },
	RequestContext: { currentTenantId: () => 'tenant-1' },
	parseFindOptionsRelations: (value: any) => value,
	parseFindOptionsSelect: (value: any) => value,
	prepareSQLQuery: (value: string) => value.replace(/"/g, '`'),
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
 * `updateDescriptionFields` scoped its raw update with a hard-coded `"tenantId"`. On MySQL a double-quoted
 * token is a string literal, so the condition compared the text 'tenantId' with the tenant id, matched no
 * row, and the description of an article was never saved.
 */
describe('HelpCenterArticleService.updateDescriptionFields (MySQL) tenant scope', () => {
	it('quotes the tenant column for the configured dialect', async () => {
		const queryBuilder: any = {
			update: jest.fn(() => queryBuilder),
			set: jest.fn(() => queryBuilder),
			where: jest.fn(() => queryBuilder),
			andWhere: jest.fn(() => queryBuilder),
			execute: jest.fn(async () => undefined)
		};
		const typeOrmRepository = { createQueryBuilder: jest.fn(() => queryBuilder) };
		const service = new HelpCenterArticleService(typeOrmRepository as any, {} as any, {} as any);

		await service.updateDescriptionFields('article-1' as ID, { descriptionJson: '{}' });

		expect(queryBuilder.andWhere).toHaveBeenCalledWith('`tenantId` = :tenantId', { tenantId: 'tenant-1' });
		expect(queryBuilder.execute).toHaveBeenCalledTimes(1);
	});

	it('leaves no double-quoted identifier in any condition of the update', async () => {
		const queryBuilder: any = {
			update: jest.fn(() => queryBuilder),
			set: jest.fn(() => queryBuilder),
			where: jest.fn(() => queryBuilder),
			andWhere: jest.fn(() => queryBuilder),
			execute: jest.fn(async () => undefined)
		};
		const typeOrmRepository = { createQueryBuilder: jest.fn(() => queryBuilder) };
		const service = new HelpCenterArticleService(typeOrmRepository as any, {} as any, {} as any);

		await service.updateDescriptionFields('article-1' as ID, { descriptionJson: '{}' });

		// On MySQL a double-quoted token is a string literal: such a condition matches no row
		const conditions = [...queryBuilder.where.mock.calls, ...queryBuilder.andWhere.mock.calls].map(
			([condition]) => condition
		);
		expect(conditions.length).toBeGreaterThan(0);
		for (const condition of conditions) {
			expect(condition).not.toContain('"');
		}
	});
});
