/**
 * `@gauzy/core` is a barrel over the whole server core, so it is stubbed as in the other specs of this folder. The
 * column rule itself is covered in core (`caller-restricted-columns.service-built-reads.spec.ts`); what is under
 * test here is that the article list, which builds its own query, asserts it on the caller's options first.
 */
jest.mock('@gauzy/core', () => ({
	TenantAwareCrudService: class TenantAwareCrudService {
		constructor(
			public readonly typeOrmRepository: any,
			public readonly mikroOrmRepository: any
		) {}
		get ormType(): string {
			return 'typeorm';
		}
		assertRelationsPermitted(): void {
			return undefined;
		}
	},
	assertCallerColumnsAllowed: jest.fn(),
	MultiORMEnum: { TypeORM: 'typeorm', MikroORM: 'mikro-orm' },
	RequestContext: { currentTenantId: () => 'tenant-1', currentEmployeeId: () => 'employee-1' },
	parseFindOptionsRelations: (value: any) => value,
	parseFindOptionsSelect: (value: any) => value,
	prepareSQLQuery: (value: string) => value,
	LIKE_OPERATOR: 'ILIKE',
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

import { BadRequestException } from '@nestjs/common';
import { ID } from '@gauzy/contracts';
import { assertCallerColumnsAllowed } from '@gauzy/core';
import { HelpCenterArticleService } from './help-center-article.service';

const PROJECT_ID = 'bbbbbbbb-2222-4222-8222-222222222222' as ID;

describe('HelpCenterArticleService — caller columns on the article list', () => {
	const assertColumns = assertCallerColumnsAllowed as jest.Mock;

	function createService() {
		const metadata = { name: 'HelpCenterArticle' };
		const typeOrmRepository = {
			metadata,
			createQueryBuilder: jest.fn(() => {
				throw new Error('store reached');
			})
		};
		const service = new HelpCenterArticleService(typeOrmRepository as any, {} as any, {} as any);
		return { service, typeOrmRepository, metadata };
	}

	afterEach(() => assertColumns.mockReset());

	it('checks the caller options before building the query', async () => {
		const { service, typeOrmRepository, metadata } = createService();
		const options = { where: { organizationId: 'org-1' }, order: { createdByUser: { hash: 'ASC' } } };
		assertColumns.mockImplementation(() => {
			throw new BadRequestException('refused');
		});

		await expect(service.getArticlesByProjectId(PROJECT_ID, options as any)).rejects.toThrow(BadRequestException);
		expect(assertColumns).toHaveBeenCalledWith(metadata, options);
		expect(typeOrmRepository.createQueryBuilder).not.toHaveBeenCalled();
	});

	it('builds the query once the caller options pass', async () => {
		const { service, typeOrmRepository } = createService();
		const options = { where: { organizationId: 'org-1' }, order: { title: 'ASC' } };

		await expect(service.getArticlesByProjectId(PROJECT_ID, options as any)).rejects.toBeDefined();
		expect(assertColumns).toHaveBeenCalled();
		expect(typeOrmRepository.createQueryBuilder).toHaveBeenCalled();
	});
});
