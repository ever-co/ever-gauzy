/**
 * Category delete/merge on MySQL.
 *
 * The pivot statements are written with double-quoted identifiers, which MySQL reads as string
 * literals: `"documentCategoryId" = :id` compares two strings and matches nothing, so a delete
 * left the pivot rows behind and a merge re-pointed no document. They must go through
 * `prepareSQLQuery` like the rest of the service.
 *
 * `@gauzy/core` boots the whole application graph on import, so the framework seams are mocked at
 * the module boundary; `prepareSQLQuery` is stubbed with its MySQL behaviour.
 */
jest.mock('@gauzy/core', () => ({
	RequestContext: {
		currentTenantId: () => 'tenant-1'
	},
	TenantAwareCrudService: class {},
	prepareSQLQuery: (query: string) => query.replace(/"/g, '`')
}));
jest.mock('../dto', () => ({ CreateDocumentCategoryDTO: class {}, UpdateDocumentCategoryDTO: class {} }));
jest.mock('../entities/document-category.entity', () => ({ DocumentCategory: class {} }));
jest.mock('../repositories/mikro-orm-document-category.repository', () => ({
	MikroOrmDocumentCategoryRepository: class {}
}));
jest.mock('../repositories/type-orm-document-category.repository', () => ({
	TypeOrmDocumentCategoryRepository: class {}
}));

import { DocumentCategoryService } from './document-category.service';

/** Records every select/where fragment handed to the query builders. */
function createStub(rowsByCategory: Record<string, Array<{ documentId: string }>> = {}) {
	const fragments: string[] = [];
	const createQueryBuilder = jest.fn(() => {
		let params: Record<string, any> = {};
		const qb: any = {
			select: jest.fn((selection: string) => {
				fragments.push(selection);
				return qb;
			}),
			delete: jest.fn(() => qb),
			insert: jest.fn(() => qb),
			into: jest.fn(() => qb),
			values: jest.fn(() => qb),
			from: jest.fn(() => qb),
			where: jest.fn((condition: string, parameters: Record<string, any>) => {
				fragments.push(condition);
				params = parameters;
				return qb;
			}),
			execute: jest.fn().mockResolvedValue({}),
			getRawMany: jest.fn(async () => rowsByCategory[Object.values(params)[0]] ?? [])
		};
		return qb;
	});
	const stub: any = {
		findOneByIdString: jest.fn(async (id: string) => ({ id, isSystem: false })),
		softDelete: jest.fn().mockResolvedValue(undefined),
		logger: { log: jest.fn() },
		typeOrmRepository: { manager: { createQueryBuilder } }
	};
	return { stub, fragments };
}

describe('DocumentCategoryService on MySQL', () => {
	it('deleteCategory quotes the pivot column with backticks', async () => {
		const { stub, fragments } = createStub();

		await DocumentCategoryService.prototype.deleteCategory.call(stub, 'category-1');

		expect(fragments).toEqual(['`documentCategoryId` = :id']);
		expect(stub.softDelete).toHaveBeenCalledWith('category-1');
	});

	it('mergeCategory quotes every pivot select and where with backticks', async () => {
		const { stub, fragments } = createStub({ source: [{ documentId: 'doc-1' }] });

		await DocumentCategoryService.prototype.mergeCategory.call(stub, 'source', 'target');

		expect(fragments.length).toBeGreaterThan(0);
		for (const fragment of fragments) {
			expect(fragment).not.toContain('"');
		}
		expect(fragments).toEqual(
			expect.arrayContaining([
				'`pivot`.`documentId`',
				'`pivot`.`documentCategoryId` = :sourceId',
				'`pivot`.`documentCategoryId` = :targetId',
				'`documentCategoryId` = :sourceId'
			])
		);
	});
});
