/**
 * Regression cover for the `GET /plugins/docs/links` leak.
 *
 * `getLinksForEntity` used to hydrate the whole `document` relation with no visibility,
 * ownership or organization filter, so any `DOCS_READ` holder could read other users' PRIVATE
 * documents and other organizations' documents — content columns, storage key and the resolved
 * `fileUrl` included. `getLinksForDocument` leaked the same way at one remove: the existence
 * and count of links/attachments on a document the caller may not read.
 */
const requestContext = {
	tenantId: 'tenant-1' as string | null,
	organizationId: 'org-1' as string | null
};

jest.mock(
	'@gauzy/core',
	() => ({
		RequestContext: {
			currentTenantId: () => requestContext.tenantId,
			currentOrganizationId: () => requestContext.organizationId
		},
		TenantAwareCrudService: class {
			protected typeOrmRepository: any;
			constructor(typeOrmRepository: any) {
				this.typeOrmRepository = typeOrmRepository;
			}
		},
		prepareSQLQuery: (sql: string) => sql
	}),
	{ virtual: true }
);
jest.mock('@gauzy/config', () => ({ isSqlite: () => false, isBetterSqlite3: () => false }), { virtual: true });
jest.mock('../entities/document-link.entity', () => ({ DocumentLink: class {} }));
jest.mock('../repositories/type-orm-document-link.repository', () => ({ TypeOrmDocumentLinkRepository: class {} }));
jest.mock('../repositories/mikro-orm-document-link.repository', () => ({ MikroOrmDocumentLinkRepository: class {} }));
jest.mock('./document.service', () => ({
	DocumentService: class {},
	DOCUMENT_LIST_COLUMNS: ['id', 'name', 'kind', 'visibility', 'organizationId']
}));
jest.mock('../dto', () => ({}));

import { NotFoundException } from '@nestjs/common';
import { BaseEntityEnum } from '@gauzy/contracts';
import { DocumentLinkService } from './document-link.service';

/** Records the query the service builds so the emitted scope can be asserted. */
const recordingQueryBuilder = (items: any[] = []) => {
	const clauses: Array<{ sql: any; params?: any }> = [];
	const selects: string[][] = [];
	const joins: Array<[string, string]> = [];
	const qb: any = {
		clauses,
		selects,
		joins,
		innerJoin: (relation: string, alias: string) => (joins.push([relation, alias]), qb),
		addSelect: (columns: string[]) => (selects.push(columns), qb),
		where: (sql: any, params?: any) => (clauses.push({ sql, params }), qb),
		andWhere: (sql: any, params?: any) => (clauses.push({ sql, params }), qb),
		orWhere: (sql: any, params?: any) => (clauses.push({ sql, params }), qb),
		orderBy: () => qb,
		getManyAndCount: async () => [items, items.length]
	};
	return qb;
};

const buildService = (options: { items?: any[]; document?: any; notFound?: boolean } = {}) => {
	const queryBuilder = recordingQueryBuilder(options.items ?? []);
	const repository: any = { createQueryBuilder: jest.fn(() => queryBuilder) };
	const documentService: any = {
		resolveOrganizationId: jest.fn(
			({ organizationId }: any = {}) => organizationId ?? requestContext.organizationId
		),
		applyVisibilityScope: jest.fn((qb: any, alias: string) =>
			qb.andWhere(`<visibility-scope:${alias}>`)
		),
		findOneScoped: jest.fn(async () => {
			if (options.notFound) {
				throw new NotFoundException('Document was not found');
			}
			return options.document ?? { id: 'doc-1', organizationId: 'org-1' };
		})
	};
	const service = new DocumentLinkService(repository, {} as any, documentService);
	return { service, queryBuilder, documentService };
};

const sqlOf = (queryBuilder: any): string => queryBuilder.clauses.map((clause: any) => String(clause.sql)).join(' | ');

beforeEach(() => {
	requestContext.tenantId = 'tenant-1';
	requestContext.organizationId = 'org-1';
});

describe('DocumentLinkService — reverse lookup scope', () => {
	it('scopes the link row AND the joined document by organization', async () => {
		const { service, queryBuilder } = buildService();

		await service.getLinksForEntity(BaseEntityEnum.OrganizationProject, 'entity-1');

		const sql = sqlOf(queryBuilder);
		expect(sql).toContain('"document_link"."organizationId" = :organizationId');
		expect(sql).toContain('"document"."organizationId" = :organizationId');
		expect(sql).toContain('"document"."tenantId" = :tenantId');
		const organizationClause = queryBuilder.clauses.find((clause: any) => clause.params?.organizationId);
		expect(organizationClause.params).toEqual({ organizationId: 'org-1' });
	});

	it('applies the visibility + share predicate to the joined document', async () => {
		const { service, queryBuilder, documentService } = buildService();

		await service.getLinksForEntity(BaseEntityEnum.OrganizationProject, 'entity-1');

		expect(documentService.applyVisibilityScope).toHaveBeenCalledWith(expect.anything(), 'document');
		expect(sqlOf(queryBuilder)).toContain('<visibility-scope:document>');
	});

	it('INNER joins the document so an out-of-scope document drops the link row entirely', async () => {
		const { service, queryBuilder } = buildService();

		await service.getLinksForEntity(BaseEntityEnum.OrganizationProject, 'entity-1');

		expect(queryBuilder.joins).toEqual([['document_link.document', 'document']]);
	});

	it('projects ONLY the list-safe document columns (never content or the storage key)', async () => {
		const { service, queryBuilder } = buildService();

		await service.getLinksForEntity(BaseEntityEnum.OrganizationProject, 'entity-1');

		const projected: string[] = queryBuilder.selects.flat();
		expect(projected).toContain('document.id');
		expect(projected).toContain('document.name');
		for (const leaked of ['contentJson', 'contentHtml', 'contentBinary', 'extractedText', 'storageKey']) {
			expect(projected.some((column) => column.includes(leaked))).toBe(false);
		}
	});

	it('honors an explicitly requested organization scope', async () => {
		const { service, documentService } = buildService();

		await service.getLinksForEntity(BaseEntityEnum.OrganizationProject, 'entity-1', 'org-7');

		expect(documentService.resolveOrganizationId).toHaveBeenCalledWith({ organizationId: 'org-7' });
	});
});

describe('DocumentLinkService — forward lookup scope', () => {
	it('resolves the document through the read scope before listing its links', async () => {
		const { service, documentService } = buildService();

		await service.getLinksForDocument('doc-1');

		expect(documentService.findOneScoped).toHaveBeenCalledWith('doc-1', [], undefined);
	});

	it('threads the client-selected organization into the document read', async () => {
		// Without it the read falls back to the token's organization — null for a non-employee
		// user (400 on the whole links panel), stale when another organization is being browsed.
		const { service, documentService } = buildService();

		await service.getLinksForDocument('doc-1', 'org-7');

		expect(documentService.findOneScoped).toHaveBeenCalledWith('doc-1', [], 'org-7');
	});

	it('404s instead of revealing that links exist on an unreadable document', async () => {
		const { service, queryBuilder } = buildService({ notFound: true });

		await expect(service.getLinksForDocument('doc-1')).rejects.toBeInstanceOf(NotFoundException);
		expect(queryBuilder.clauses).toHaveLength(0);
	});

	it('scopes the listing to the resolved document organization', async () => {
		const { service, queryBuilder } = buildService({ document: { id: 'doc-1', organizationId: 'org-3' } });

		await service.getLinksForDocument('doc-1');

		const organizationClause = queryBuilder.clauses.find((clause: any) => clause.params?.organizationId);
		expect(organizationClause.params).toEqual({ organizationId: 'org-3' });
		expect(sqlOf(queryBuilder)).toContain('<visibility-scope:document>');
	});
});
