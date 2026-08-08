/**
 * Regression cover for the organization / write-access scoping of `DocumentService`
 * (`08-permissions-security.md` §3.4).
 *
 * Three defects are pinned here:
 *
 * 1. `findOneScoped` used to delegate to the inherited `findOneByIdString`, which merges the
 *    **tenant only** — so `GET /documents/:id` returned another organization's document.
 * 2. `buildFilteredQuery` only added `organizationId` when the DTO carried one, but
 *    `whitelist: true` strips it — so a bare `GET /documents` listed the whole tenant.
 * 3. `canWrite` was unit-tested but called from no production path, so a `VIEW`-share grantee
 *    could mutate a document they were only allowed to read.
 *
 * `@gauzy/core` boots the whole application graph on import, so the framework seams are mocked
 * at the module boundary; the service under test is the real one.
 */
const sanitizeRichHtmlMock = jest.fn((html: string) => `sanitized(${html})`);

const requestContext = {
	tenantId: 'tenant-1' as string | null,
	organizationId: 'org-1' as string | null,
	userId: 'user-1' as string | null,
	permissions: [] as string[]
};

jest.mock(
	'@gauzy/core',
	() => ({
		FavoriteService: () => () => undefined,
		EventBus: class {},
		RequestContext: {
			currentTenantId: () => requestContext.tenantId,
			currentOrganizationId: () => requestContext.organizationId,
			currentUserId: () => requestContext.userId,
			currentRequestContext: () => ({}),
			hasPermission: (permission: string) => requestContext.permissions.includes(permission)
		},
		TenantAwareCrudService: class {
			protected typeOrmRepository: any;
			constructor(typeOrmRepository: any) {
				this.typeOrmRepository = typeOrmRepository;
			}
		},
		prepareSQLQuery: (sql: string) => sql,
		sanitizeRichHtml: (html: string) => sanitizeRichHtmlMock(html)
	}),
	{ virtual: true }
);
jest.mock('../entities/document.entity', () => ({ Document: class {} }));
jest.mock('../events/document.event', () => ({ DocumentEvent: class {} }));
jest.mock('../repositories/type-orm-document.repository', () => ({ TypeOrmDocumentRepository: class {} }));
jest.mock('../repositories/mikro-orm-document.repository', () => ({ MikroOrmDocumentRepository: class {} }));
jest.mock('./document-version.service', () => ({ DocumentVersionService: class {} }));
jest.mock('./document-access.service', () => ({ DocumentAccessService: class {} }));
jest.mock('../dto', () => ({}));

import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DocumentVisibilityEnum, PermissionsEnum } from '@gauzy/contracts';
import { DOCS_ORGANIZATION_REQUIRED, DOCS_WRITE_FORBIDDEN } from '../docs.constants';
import { DocumentService } from './document.service';

/** A document row stub carrying only the fields the scope code reads. */
const documentRow = (overrides: Record<string, any> = {}): any => ({
	id: 'doc-1',
	tenantId: 'tenant-1',
	organizationId: 'org-1',
	createdByUserId: 'user-1',
	visibility: DocumentVisibilityEnum.ORGANIZATION,
	isLocked: false,
	...overrides
});

/** Records every `where`/`andWhere` clause so the emitted scope can be asserted. */
const recordingQueryBuilder = () => {
	const clauses: Array<{ sql: any; params?: any }> = [];
	const qb: any = {
		clauses,
		where: (sql: any, params?: any) => (clauses.push({ sql, params }), qb),
		andWhere: (sql: any, params?: any) => (clauses.push({ sql, params }), qb),
		orWhere: (sql: any, params?: any) => (clauses.push({ sql, params }), qb),
		select: () => qb,
		addSelect: () => qb,
		orderBy: () => qb,
		take: () => qb,
		skip: () => qb,
		getCount: async () => 0
	};
	return qb;
};

/**
 * Builds the real service over stub collaborators.
 *
 * @param rows Rows the repository may return, matched on the full `where` object.
 * @param access Stubbed answers of the share-overlay service.
 */
const buildService = (rows: any[] = [], access: { canRead?: boolean; canWrite?: boolean } = {}) => {
	const findOne = jest.fn(async ({ where }: any) =>
		rows.find(
			(row) =>
				row.id === where.id && row.tenantId === where.tenantId && row.organizationId === where.organizationId
		) ?? null
	);
	const queryBuilder = recordingQueryBuilder();
	const repository: any = {
		findOne,
		createQueryBuilder: jest.fn(() => queryBuilder)
	};
	const accessService: any = {
		canRead: jest.fn(async () => access.canRead ?? false),
		canWrite: jest.fn(async () => access.canWrite ?? false),
		applyShareScope: jest.fn(() => false)
	};
	const service = new DocumentService(repository, {} as any, {} as any, accessService, { publish: jest.fn() } as any);
	return { service, repository, accessService, queryBuilder, findOne };
};

beforeEach(() => {
	requestContext.tenantId = 'tenant-1';
	requestContext.organizationId = 'org-1';
	requestContext.userId = 'user-1';
	requestContext.permissions = [PermissionsEnum.DOCS_READ, PermissionsEnum.DOCS_UPDATE];
	sanitizeRichHtmlMock.mockClear();
});

describe('DocumentService — organization scope', () => {
	it('resolves a document that belongs to the requester organization', async () => {
		const { service, findOne } = buildService([documentRow()]);

		await expect(service.findOneScoped('doc-1')).resolves.toMatchObject({ id: 'doc-1' });
		expect(findOne).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: 'doc-1', tenantId: 'tenant-1', organizationId: 'org-1' }
			})
		);
	});

	it('404s a document of ANOTHER organization inside the same tenant', async () => {
		const { service } = buildService([documentRow({ organizationId: 'org-2' })]);

		await expect(service.findOneScoped('doc-1')).rejects.toBeInstanceOf(NotFoundException);
	});

	it('404s a soft-deleted document of another organization on the recovery lookup', async () => {
		const { service, findOne } = buildService([documentRow({ organizationId: 'org-2', deletedAt: new Date() })]);

		await expect(service.findOneDeletedScoped('doc-1')).rejects.toBeInstanceOf(NotFoundException);
		expect(findOne).toHaveBeenCalledWith(expect.objectContaining({ withDeleted: true }));
	});

	it('404s someone else PRIVATE document when no share grants access', async () => {
		const { service } = buildService(
			[documentRow({ visibility: DocumentVisibilityEnum.PRIVATE, createdByUserId: 'user-2' })],
			{ canRead: false }
		);

		await expect(service.findOneScoped('doc-1')).rejects.toBeInstanceOf(NotFoundException);
	});

	it('resolves someone else PRIVATE document when a share grants access', async () => {
		const { service } = buildService(
			[documentRow({ visibility: DocumentVisibilityEnum.PRIVATE, createdByUserId: 'user-2' })],
			{ canRead: true }
		);

		await expect(service.findOneScoped('doc-1')).resolves.toMatchObject({ id: 'doc-1' });
	});

	it('constrains the list query by organization even when the filter set carries none', async () => {
		const { service, queryBuilder } = buildService();

		await service.getDocumentCount({} as any);

		const organizationClause = queryBuilder.clauses.find((clause: any) =>
			String(clause.sql).includes('"document"."organizationId"')
		);
		expect(organizationClause).toBeDefined();
		expect(organizationClause.params).toEqual({ organizationId: 'org-1' });
	});

	it('rejects a request whose organization scope cannot be resolved at all', async () => {
		requestContext.organizationId = null;
		const { service } = buildService();

		await expect(service.getDocumentCount({} as any)).rejects.toMatchObject({
			response: { code: DOCS_ORGANIZATION_REQUIRED }
		});
		await expect(service.getDocumentCount({} as any)).rejects.toBeInstanceOf(BadRequestException);
	});

	it('prefers an explicit organization scope over the request context', () => {
		const { service } = buildService();

		expect(service.resolveOrganizationId({ organizationId: 'org-9' })).toBe('org-9');
		expect(service.resolveOrganizationId({ where: { organizationId: 'org-8' } } as any)).toBe('org-8');
		expect(service.resolveOrganizationId()).toBe('org-1');
	});
});

describe('DocumentService — write access', () => {
	it('rejects a mutation the share overlay only grants VIEW for', async () => {
		const { service } = buildService([], { canWrite: false });

		await expect(service.assertCanWrite(documentRow())).rejects.toBeInstanceOf(ForbiddenException);
		await expect(service.assertCanWrite(documentRow())).rejects.toMatchObject({
			response: { code: DOCS_WRITE_FORBIDDEN }
		});
	});

	it('passes the visibility/ownership projection to the share evaluation', async () => {
		const { service, accessService } = buildService([], { canWrite: true });
		const document = documentRow({ visibility: DocumentVisibilityEnum.PRIVATE, isLocked: true });

		await expect(service.assertCanWrite(document)).resolves.toBeUndefined();
		expect(accessService.canWrite).toHaveBeenCalledWith(
			{ createdByUserId: 'user-1', visibility: DocumentVisibilityEnum.PRIVATE, isLocked: true },
			'doc-1'
		);
	});

	it('blocks a metadata update by a read-only grantee before anything is written', async () => {
		const { service } = buildService([documentRow()], { canWrite: false });
		(service as any).save = jest.fn();

		await expect(service.updateDocument('doc-1', { name: 'renamed' } as any)).rejects.toBeInstanceOf(
			ForbiddenException
		);
		expect((service as any).save).not.toHaveBeenCalled();
	});

	it('blocks a content save by a read-only grantee before anything is written', async () => {
		const { service } = buildService([documentRow()], { canWrite: false });
		(service as any).save = jest.fn();

		await expect(service.updateContent('doc-1', { contentJson: {} } as any)).rejects.toBeInstanceOf(
			ForbiddenException
		);
		expect((service as any).save).not.toHaveBeenCalled();
	});
});

describe('DocumentService — HTML sanitization', () => {
	it('routes contentHtml through the shared allowlist sanitizer on create', async () => {
		const { service } = buildService();
		(service as any).create = jest.fn(async (input: any) => input);

		await service.createDocument({ kind: 'PAGE', name: 'p', contentHtml: '<p>hi</p>' } as any);

		expect(sanitizeRichHtmlMock).toHaveBeenCalledWith('<p>hi</p>');
		expect((service as any).create.mock.calls[0][0].contentHtml).toBe('sanitized(<p>hi</p>)');
	});

	it('routes contentHtml through the shared allowlist sanitizer on a content save', async () => {
		const { service } = buildService([documentRow({ kind: 'PAGE', updatedAt: new Date(0) })], { canWrite: true });
		(service as any).save = jest.fn(async (input: any) => input);
		(service as any).documentVersionService = { captureSnapshotIfNeeded: jest.fn() };

		await service.updateContent('doc-1', { contentJson: {}, contentHtml: '<b>x</b>' } as any);

		expect(sanitizeRichHtmlMock).toHaveBeenCalledWith('<b>x</b>');
		expect((service as any).save.mock.calls[0][0].contentHtml).toBe('sanitized(<b>x</b>)');
	});
});
