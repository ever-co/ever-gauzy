const mockSubject: { userId: string; employeeId: string | null; teamIds: string[]; manage: boolean } = {
	userId: 'reader',
	employeeId: 'reader-employee',
	teamIds: [],
	manage: false
};

const mockBoundary: { refuse: null | 'forbidden' | 'bad-request' } = { refuse: null };
const mockTenant: { id: string | null } = { id: 'tenant-1' };

jest.mock('@gauzy/core', () => {
	const { BadRequestException, ForbiddenException } = jest.requireActual('@nestjs/common');
	return {
		CommentParentAccessPolicy: () => () => undefined,
		RequestContext: { currentTenantId: () => mockTenant.id },
		// The platform's organization boundary: a tenant admin reaches every organization, anyone else their own.
		assertCurrentUserBelongsToOrganization: jest.fn(async () => {
			if (mockBoundary.refuse === 'forbidden') throw new ForbiddenException('You are not a member of this organization');
			if (mockBoundary.refuse === 'bad-request') throw new BadRequestException('organizationId is required');
		})
	};
});
jest.mock('../repositories/type-orm-document.repository', () => ({
	TypeOrmDocumentRepository: class TypeOrmDocumentRepository {}
}));
jest.mock('../entities/document.entity', () => ({ Document: class Document {} }));
jest.mock('./document.service', () => ({ DocumentService: class DocumentService {} }));
jest.mock('./document-access.service', () => ({ DocumentAccessService: class DocumentAccessService {} }));

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BaseEntityEnum, DocumentShareAccessEnum, DocumentVisibilityEnum, PermissionsEnum } from '@gauzy/contracts';
import { DocumentCommentAccessPolicy } from './document-comment-access.policy';

const PAGE = '0b7f3a52-6c1d-4e8a-9f2b-3c4d5e6f7a8b';

interface Page {
	id: string;
	organizationId: string | null;
	visibility: DocumentVisibilityEnum;
	createdByUserId: string;
	organizationTeamId?: string | null;
}

/** The policy over a page store: `findOneScoped` answers the page or refuses it, as the page's own read would. */
function build(page: Page | null, options: { share?: DocumentShareAccessEnum | null; writable?: boolean; refuse?: 'not-found' | 'forbidden' | 'crash' } = {}) {
	const documentService = {
		findOneScoped: jest.fn(async (id: string) => {
			if (options.refuse === 'crash') throw new Error('database unavailable');
			if (options.refuse === 'forbidden') throw new ForbiddenException();
			if (!page || page.id !== id || options.refuse === 'not-found') throw new NotFoundException();
			return page;
		})
	};
	const rank = { [DocumentShareAccessEnum.VIEW]: 1, [DocumentShareAccessEnum.COMMENT]: 2, [DocumentShareAccessEnum.EDIT]: 3 } as Record<string, number>;
	const access = {
		currentSubject: jest.fn(async () => ({
			userId: mockSubject.userId,
			employeeId: mockSubject.employeeId,
			teamIds: mockSubject.teamIds,
			hasReadPermission: true,
			hasManagePermission: mockSubject.manage
		})),
		hasShareAtLeast: jest.fn(async (_row: unknown, _id: string, minimum: DocumentShareAccessEnum) =>
			options.share ? rank[options.share] >= rank[minimum] : false
		),
		canWrite: jest.fn(async () => !!options.writable)
	};
	// The page located in the tenant, by id, before the boundary and the scoped read.
	const manager = {
		findOne: jest.fn(async (_entity: unknown, { where }: { where: { id: string; tenantId: string } }) =>
			page && page.id === where.id && where.tenantId === 'tenant-1' ? { id: page.id, organizationId: page.organizationId } : null
		)
	};
	return {
		policy: new DocumentCommentAccessPolicy(documentService as never, access as never, { manager } as never),
		documentService,
		access
	};
}

const privatePage = (owner = 'someone-else'): Page => ({
	id: PAGE,
	organizationId: 'org-1',
	visibility: DocumentVisibilityEnum.PRIVATE,
	createdByUserId: owner
});

describe('DocumentCommentAccessPolicy', () => {
	afterEach(() => {
		mockBoundary.refuse = null;
		mockTenant.id = 'tenant-1';
	});

	it("reads the page in the page's own organization, not the one the request names", async () => {
		const { policy, documentService } = build({ ...privatePage(), organizationId: 'org-of-page' });

		await expect(policy.findAccessibleParent(PAGE as never)).resolves.toEqual({ id: PAGE, organizationId: 'org-of-page' });
		expect(documentService.findOneScoped).toHaveBeenCalledWith(PAGE, [], 'org-of-page');
	});

	it("answers as missing a page of an organization the caller may not reach, or without a tenant", async () => {
		mockBoundary.refuse = 'forbidden';
		await expect(build(privatePage()).policy.findAccessibleParent(PAGE as never)).resolves.toBeNull();
		mockBoundary.refuse = 'bad-request';
		await expect(build(privatePage()).policy.findWritableParent(PAGE as never)).resolves.toBeNull();
		mockBoundary.refuse = null;
		mockTenant.id = null;
		await expect(build(privatePage()).policy.findAccessibleParent(PAGE as never)).resolves.toBeNull();
	});

	it('governs the comments of a Docs page with the Docs read permission', () => {
		const { policy } = build(null);
		expect(policy.entity).toBe(BaseEntityEnum.Document);
		expect(policy.readPermissions).toEqual([PermissionsEnum.DOCS_READ]);
		expect(policy.writePermissions).toEqual([PermissionsEnum.DOCS_READ]);
	});

	it('lets a caller who may read the page read its comments, and answers a page they may not reach as missing', async () => {
		await expect(build(privatePage()).policy.findAccessibleParent(PAGE as never)).resolves.toEqual({ id: PAGE, organizationId: 'org-1' });
		await expect(build(privatePage(), { refuse: 'not-found' }).policy.findAccessibleParent(PAGE as never)).resolves.toBeNull();
		await expect(build(privatePage(), { refuse: 'forbidden' }).policy.findAccessibleParent(PAGE as never)).resolves.toBeNull();
	});

	it('fails rather than guesses when the page read fails', async () => {
		await expect(build(privatePage(), { refuse: 'crash' }).policy.findAccessibleParent(PAGE as never)).rejects.toThrow('database unavailable');
	});

	it('lets anyone who reads an organization page, or their own page, write its comments', async () => {
		const organizationPage = { ...privatePage(), visibility: DocumentVisibilityEnum.ORGANIZATION };
		await expect(build(organizationPage).policy.findWritableParent(PAGE as never)).resolves.toEqual({ id: PAGE, organizationId: 'org-1' });
		await expect(build(privatePage('reader')).policy.findWritableParent(PAGE as never)).resolves.toEqual({ id: PAGE, organizationId: 'org-1' });
	});

	it('keeps a page reached only through a VIEW share read-only, and takes comments with a COMMENT or EDIT share', async () => {
		await expect(build(privatePage(), { share: DocumentShareAccessEnum.VIEW }).policy.findWritableParent(PAGE as never)).resolves.toBeNull();
		await expect(build(privatePage(), { share: DocumentShareAccessEnum.COMMENT }).policy.findWritableParent(PAGE as never)).resolves.toEqual({
			id: PAGE,
			organizationId: 'org-1'
		});
		await expect(build(privatePage(), { share: DocumentShareAccessEnum.EDIT }).policy.findWritableParent(PAGE as never)).resolves.not.toBeNull();
	});

	it('lets a caller who may edit the page write its comments', async () => {
		await expect(build(privatePage(), { writable: true }).policy.findWritableParent(PAGE as never)).resolves.not.toBeNull();
	});

	it('answers a page the caller may not read as missing for writes too', async () => {
		await expect(build(privatePage(), { refuse: 'not-found', share: DocumentShareAccessEnum.EDIT }).policy.findWritableParent(PAGE as never)).resolves.toBeNull();
	});
});
