/**
 * Regression cover for document categories addressed across organizations.
 *
 * `updateCategory`, `mergeCategory` and `deleteCategory` all start from the tenant-aware read by id, which narrows to
 * the caller's tenant only, so a `DOCS_MANAGE` holder of one organization renamed, merged and deleted another
 * organization's categories, and a merge re-pointed one organization's document assignments into another's catalog.
 */
const ORG = 'org-1';
const SIBLING_ORG = 'org-2';
const requestContext = { organizationId: ORG as string | null };
const rows: Record<string, Record<string, unknown>> = {};
const writes: string[] = [];

jest.mock('@gauzy/core', () => {
	const { NotFoundException } = require('@nestjs/common');

	return {
		RequestContext: {
			currentTenantId: () => 'tenant-1',
			currentOrganizationId: () => requestContext.organizationId
		},
		TenantAwareCrudService: class {
			protected typeOrmRepository: any;
			constructor(typeOrmRepository: any) {
				this.typeOrmRepository = typeOrmRepository;
			}

			/** The tenant-scoped read: every category of the caller's tenant, of any organization. */
			async findOneByIdString(id: string): Promise<unknown> {
				if (!rows[id]) {
					throw new NotFoundException('The requested record was not found');
				}
				return rows[id];
			}

			async save(entity: { id: string }): Promise<unknown> {
				writes.push(`save:${entity.id}`);
				return entity;
			}

			async softDelete(id: string): Promise<unknown> {
				writes.push(`softDelete:${id}`);
				return { affected: 1 };
			}
		},
		prepareSQLQuery: (sql: string) => sql
	};
});
jest.mock('../entities/document-category.entity', () => ({ DocumentCategory: class {} }));
jest.mock('../repositories/type-orm-document-category.repository', () => ({
	TypeOrmDocumentCategoryRepository: class {}
}));
jest.mock('../repositories/mikro-orm-document-category.repository', () => ({
	MikroOrmDocumentCategoryRepository: class {}
}));
jest.mock('../dto', () => ({}));

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DocumentCategoryService } from './document-category.service';

describe('DocumentCategoryService — a category addressed by its id is one of the caller’s organization', () => {
	/** Any statement the merge or the delete would run against the pivot table is recorded, never executed. */
	const builder: any = new Proxy(
		{},
		{
			get: (_target, member) =>
				member === 'execute' || member === 'getRawMany'
					? async () => {
							writes.push(`pivot:${String(member)}`);
							return [];
						}
					: () => builder
		}
	);
	const repository = { manager: { createQueryBuilder: () => builder } };
	const service = new DocumentCategoryService(repository as never, {} as never);

	beforeEach(() => {
		requestContext.organizationId = ORG;
		writes.length = 0;
		rows['own'] = { id: 'own', name: 'Own', slug: 'own', organizationId: ORG, isSystem: false };
		rows['own-2'] = { id: 'own-2', name: 'Own 2', slug: 'own-2', organizationId: ORG, isSystem: false };
		rows['sibling'] = {
			id: 'sibling',
			name: 'Theirs',
			slug: 'theirs',
			organizationId: SIBLING_ORG,
			isSystem: false
		};
	});

	it('reads the caller’s own category', async () => {
		await expect(service.findOneByIdString('own')).resolves.toMatchObject({ id: 'own' });
	});

	it('does not rename, delete or merge a sibling organization’s category, and writes nothing', async () => {
		await expect(service.updateCategory('sibling', { color: '#000' } as never)).rejects.toBeInstanceOf(
			NotFoundException
		);
		await expect(service.deleteCategory('sibling')).rejects.toBeInstanceOf(NotFoundException);
		await expect(service.mergeCategory('sibling', 'own')).rejects.toBeInstanceOf(NotFoundException);
		await expect(service.mergeCategory('own', 'sibling')).rejects.toBeInstanceOf(NotFoundException);

		expect(writes).toEqual([]);
	});

	it('refuses a merge across two organizations even for a caller with no organization in context', async () => {
		requestContext.organizationId = null;

		await expect(service.mergeCategory('own', 'sibling')).rejects.toBeInstanceOf(BadRequestException);
		expect(writes).toEqual([]);
	});

	it('merges two categories of the caller’s organization', async () => {
		await expect(service.mergeCategory('own', 'own-2')).resolves.toMatchObject({ id: 'own-2' });
		expect(writes).toContain('softDelete:own');
	});
});
