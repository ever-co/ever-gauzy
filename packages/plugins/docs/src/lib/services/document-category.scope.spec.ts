import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `@gauzy/core` boots the whole application graph from its barrel, so it is doubled at the module boundary: the base
 * the category service inherits is reduced to the reads and writes it states, and to the organization boundary a case
 * confines the caller to. The boundary itself — who it confines, and how every read, write and delete of the base
 * keeps to it — is proven against real stores on both ORMs in core
 * (`tenant-aware-crud.service.organization-boundary.spec.ts`). What is proven here is that the category service asks
 * for it, that its hand-written queries keep to it, and the merge rule it adds. **The category service under test is
 * the real one.**
 */
const ORG = 'org-1';
const SIBLING_ORG = 'org-2';
const rows: Record<string, Record<string, unknown>> = {};
const writes: string[] = [];

/** The boundary a case confines the caller to: none (a tenant admin, a job) unless the case states one. */
const confinement: { boundary: { organizationId: string | null } | null } = { boundary: null };

jest.mock('@gauzy/core', () => {
	const { NotFoundException } = require('@nestjs/common');

	return {
		RequestContext: {
			currentTenantId: () => 'tenant-1'
		},
		TenantAwareCrudService: class {
			protected typeOrmRepository: any;
			constructor(typeOrmRepository: any) {
				this.typeOrmRepository = typeOrmRepository;
			}

			/** Off in the platform's base: a service applies the boundary only when it says so. */
			protected appliesOrganizationBoundary(): boolean {
				return false;
			}

			/** The boundary that applies to this service right now. */
			protected organizationBoundary(): unknown {
				return this.appliesOrganizationBoundary() ? confinement.boundary : null;
			}

			/** The read by id; the base answers a category outside the boundary as this miss. */
			async findOneByIdString(id: string): Promise<unknown> {
				if (!rows[id]) {
					throw new NotFoundException('The requested record was not found');
				}
				return rows[id];
			}

			async create(entity: { name: string }): Promise<unknown> {
				writes.push(`create:${entity.name}`);
				return entity;
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

import { BadRequestException } from '@nestjs/common';
import { DocumentCategoryService } from './document-category.service';

/**
 * The docs services that extend the tenant-aware base without the boundary, and why. Documents, their versions, links
 * and shares keep to the caller's organization through the document access rules (`DocumentService.findOneScoped`,
 * its filtered list and the share overlay); switching the boundary on for them is outside this change.
 */
const OUTSIDE_THE_BOUNDARY = [
	'document.service.ts',
	'document-version.service.ts',
	'document-link.service.ts',
	'document-share.service.ts'
];

/** Every `*.service.ts` file under a folder. */
function serviceFiles(folder: string): string[] {
	return readdirSync(folder).flatMap((name) => {
		const path = join(folder, name);
		if (statSync(path).isDirectory()) {
			return serviceFiles(path);
		}
		return name.endsWith('.service.ts') ? [path] : [];
	});
}

class CategoryService extends DocumentCategoryService {
	applies(): boolean {
		return this.appliesOrganizationBoundary();
	}
}

describe('DocumentCategoryService — the category service keeps every caller inside the organization boundary', () => {
	/** Every condition a hand-written query adds, in order. */
	let conditions: Array<{ sql: string; params?: Record<string, unknown> }>;

	/** Any statement the merge or the delete would run against the pivot table is recorded, never executed. */
	const builder: any = new Proxy(
		{},
		{
			get: (_target, member) => {
				if (member === 'execute' || member === 'getRawMany') {
					return async () => {
						writes.push(`pivot:${String(member)}`);
						return [];
					};
				}
				if (member === 'where' || member === 'andWhere') {
					return (sql: string, params?: Record<string, unknown>) => {
						conditions.push({ sql, params });
						return builder;
					};
				}
				if (member === 'getCount') {
					return async () => 0;
				}
				if (member === 'getRawAndEntities') {
					return async () => ({ entities: [], raw: [] });
				}
				if (member === 'getOne') {
					return async () => null;
				}
				return () => builder;
			}
		}
	);
	const repository = { manager: { createQueryBuilder: () => builder }, createQueryBuilder: () => builder };
	const service = new CategoryService(repository as never, {} as never);

	beforeEach(() => {
		confinement.boundary = null;
		conditions = [];
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

	it('applies the platform’s organization boundary', () => {
		expect(service.applies()).toBe(true);
	});

	it('is the boundary of every docs service but the document services listed with their reason', () => {
		const direct = serviceFiles(__dirname)
			.filter((path) => /extends\s+TenantAwareCrudService\b/.test(readFileSync(path, 'utf8')))
			.filter(
				(path) => !/appliesOrganizationBoundary\(\): boolean \{\s*return true;/.test(readFileSync(path, 'utf8'))
			)
			.map((path) => path.split(/[\\/]/).pop());

		expect(direct.sort()).toEqual([...OUTSIDE_THE_BOUNDARY].sort());
	});

	it('refuses a merge across two organizations to a caller the boundary does not confine, and writes nothing', async () => {
		// A tenant admin reaches both categories; a category is still a catalog entry of one organization.
		await expect(service.mergeCategory('own', 'sibling')).rejects.toBeInstanceOf(BadRequestException);
		expect(writes).toEqual([]);
	});

	it('merges two categories of one organization', async () => {
		await expect(service.mergeCategory('own', 'own-2')).resolves.toMatchObject({ id: 'own-2' });
		expect(writes).toContain('softDelete:own');
	});

	it('keeps a confined caller’s category list to their organization and the tenant’s own, whatever organization it states', async () => {
		confinement.boundary = { organizationId: ORG };

		await service.getCategories({ organizationId: SIBLING_ORG } as never);

		expect(conditions).toContainEqual({
			sql: '("category"."organizationId" = :boundaryOrganizationId OR "category"."organizationId" IS NULL)',
			params: { boundaryOrganizationId: ORG }
		});
	});

	it('keeps the list of a caller with no organization in their token to the tenant’s own categories', async () => {
		confinement.boundary = { organizationId: null };

		await service.getCategories({} as never);

		expect(conditions.map(({ sql }) => sql)).toContain('"category"."organizationId" IS NULL');
	});

	it('lists the organization a tenant admin states, without narrowing it to their token’s', async () => {
		await service.getCategories({ organizationId: SIBLING_ORG } as never);

		expect(conditions.map(({ sql }) => sql)).toEqual([
			'"category"."tenantId" = :tenantId',
			'"category"."organizationId" = :organizationId'
		]);
	});

	it('keeps the name check of a confined caller’s create to the boundary, so another organization’s names are not probed', async () => {
		confinement.boundary = { organizationId: ORG };
		await service.createCategory({ name: 'Theirs', organizationId: SIBLING_ORG } as never);

		expect(conditions).toContainEqual({
			sql: '("category"."organizationId" = :boundaryOrganizationId OR "category"."organizationId" IS NULL)',
			params: { boundaryOrganizationId: ORG }
		});
	});
});
