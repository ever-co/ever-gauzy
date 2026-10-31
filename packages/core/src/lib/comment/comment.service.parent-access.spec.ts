/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids.
 */
import '../core/entities/internal';

import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { And, Equal, In, Not } from 'typeorm';
import { BaseEntityEnum, ICommentCreateInput, PermissionsEnum } from '@gauzy/contracts';
import { CrudService } from '../core/crud/crud.service';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { RequestContext } from '../core/context/request-context';
import { CommentService } from './comment.service';
import { CommentResolver } from './comment.resolver';
import { CommentCreateHandler } from './commands/handlers/comment.create.handler';
import { CommentParentAccessService, ICommentParent, ICommentParentAccessPolicy } from './parent-access';

/**
 * A contact's notes are the comments whose `entity` is `OrganizationContact` (ever-co/ever-gauzy#1114). They are
 * read with `ORG_CONTACT_VIEW` and written with `ORG_CONTACT_EDIT`, on a contact the caller reaches, on every
 * path of the comment API; the comments of every other record keep the API's own rules, unchanged.
 */
const CONTACT = BaseEntityEnum.OrganizationContact;
const PROJECT = BaseEntityEnum.OrganizationProject;

const CONTACT_ID = '6d7c4a3e-1b2f-4c5d-8e9f-0a1b2c3d4e5f';
const OTHER_CONTACT_ID = '7e8d5b4f-2c3a-4d6e-9fa0-1b2c3d4e5f60';
/** A contact of another organization: the scoped contact read does not find it. */
const FOREIGN_CONTACT_ID = '8f9e6c5a-3d4b-4e7f-8a01-2c3d4e5f6071';
const PROJECT_ID = '0f1e2d3c-4b5a-4968-8776-655443322110';

/** Stored comments, by id. */
const NOTE = '11111111-1111-4111-8111-111111111111'; // a colleague's note on the contact
const OWN_NOTE = '22222222-2222-4222-8222-222222222222'; // the caller's own note on the contact
const OTHER_CONTACT_NOTE = '33333333-3333-4333-8333-333333333333';
const PROJECT_COMMENT = '44444444-4444-4444-8444-444444444444';
const LOOKALIKE_NOTE = '55555555-5555-4555-8555-555555555555';

const STORED: Record<string, { id: string; entity: string; entityId: string; employeeId: string }> = {
	[NOTE]: { id: NOTE, entity: CONTACT, entityId: CONTACT_ID, employeeId: 'employee-colleague' },
	[OWN_NOTE]: { id: OWN_NOTE, entity: CONTACT, entityId: CONTACT_ID, employeeId: 'employee-me' },
	[OTHER_CONTACT_NOTE]: {
		id: OTHER_CONTACT_NOTE,
		entity: CONTACT,
		entityId: OTHER_CONTACT_ID,
		employeeId: 'employee-me'
	},
	[PROJECT_COMMENT]: { id: PROJECT_COMMENT, entity: PROJECT, entityId: PROJECT_ID, employeeId: 'employee-me' },
	// A note stored under another spelling of the type, which MySQL reads with the contact's notes.
	[LOOKALIKE_NOTE]: {
		id: LOOKALIKE_NOTE,
		entity: 'organizationcontact',
		entityId: CONTACT_ID,
		employeeId: 'employee-colleague'
	}
};

const contactPolicy = (): ICommentParentAccessPolicy => ({
	entity: CONTACT,
	readPermissions: [PermissionsEnum.ORG_CONTACT_VIEW],
	writePermissions: [PermissionsEnum.ORG_CONTACT_EDIT],
	findAccessibleParent: jest.fn(async (id: string): Promise<ICommentParent | null> =>
		id === FOREIGN_CONTACT_ID ? null : { id, organizationId: 'organization-of-contact' }
	)
});

describe('CommentService — the comments of a governed record follow its policy, and only those', () => {
	let service: CommentService;
	let policy: ICommentParentAccessPolicy;
	let baseCreate: jest.SpyInstance;
	let withoutEmployeeFilter: jest.Mock;
	let findOne: jest.Mock;
	let hasAnyPermission: jest.SpyInstance;

	/** The caller: their own employee, their permissions, and whether they may act for other employees. */
	const as = (
		permissions: PermissionsEnum[],
		{ employeeId = 'employee-me', canChangeSelectedEmployee = false } = {}
	) => {
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(
			(canChangeSelectedEmployee ? null : employeeId) as never
		);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: 'user-me', employeeId } as never);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue('user-me' as never);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1' as never);
		jest.spyOn(RequestContext, 'hasRoles').mockReturnValue(false);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
			(permission: PermissionsEnum) =>
				(canChangeSelectedEmployee && permission === PermissionsEnum.CHANGE_SELECTED_EMPLOYEE) ||
				permissions.includes(permission)
		);
		hasAnyPermission = jest
			.spyOn(RequestContext, 'hasAnyPermission')
			.mockImplementation((wanted: PermissionsEnum[]) =>
				wanted.some((permission) => permissions.includes(permission))
			);
	};

	const note = (overrides: Partial<ICommentCreateInput> = {}): ICommentCreateInput =>
		({
			comment: 'Called them, they want a quote by Friday',
			entity: CONTACT,
			entityId: CONTACT_ID,
			organizationId: 'organization-stated',
			...overrides
		}) as ICommentCreateInput;

	beforeEach(() => {
		service = Object.create(CommentService.prototype);
		const parentAccess = new CommentParentAccessService();
		policy = contactPolicy();
		parentAccess.register(policy);

		Object.assign(service as any, {
			_parentAccess: parentAccess,
			_employeeService: { findOneByIdString: jest.fn().mockResolvedValue({ id: 'employee-me' }) },
			_mentionService: { publishMention: jest.fn(), updateEntityMentions: jest.fn() },
			_eventBus: { publish: jest.fn() }
		});

		// The tenant-scoped finder, by id; `where.employeeId` narrows it to that author.
		findOne = jest.fn(async (id: string, options?: { where?: { employeeId?: string } }) => {
			const row = STORED[id];
			if (!row || (options?.where?.employeeId && options.where.employeeId !== row.employeeId)) {
				throw new NotFoundException('The requested record was not found');
			}
			return { ...row, organizationId: 'organization-of-contact' };
		});
		withoutEmployeeFilter = jest.fn((read: () => Promise<unknown>) => read());
		Object.assign(service as any, {
			findOneByIdString: findOne,
			findOneByWhereOptions: jest.fn(async ({ id, employeeId }: { id: string; employeeId?: string }) => {
				const row = STORED[id];
				return row && (!employeeId || row.employeeId === employeeId)
					? { ...row, organizationId: 'organization-of-contact' }
					: null;
			}),
			withoutEmployeeFilter,
			withoutOrganizationBoundary: jest.fn((read: () => Promise<unknown>) => read())
		});

		baseCreate = jest
			.spyOn(TenantAwareCrudService.prototype, 'create')
			.mockImplementation(async (input) => ({ id: 'new-comment', ...input }) as never);
	});

	afterEach(() => jest.restoreAllMocks());

	describe('posting a note', () => {
		it('refuses with 403 a caller who may view the contact but not edit it', async () => {
			as([PermissionsEnum.ORG_CONTACT_VIEW]);

			await expect(service.create(note())).rejects.toBeInstanceOf(ForbiddenException);
			expect(baseCreate).not.toHaveBeenCalled();
		});

		it('answers 404 for a contact the caller does not reach, as for a missing one', async () => {
			as([PermissionsEnum.ORG_CONTACT_EDIT]);

			await expect(service.create(note({ entityId: FOREIGN_CONTACT_ID }))).rejects.toBeInstanceOf(
				NotFoundException
			);
			expect(baseCreate).not.toHaveBeenCalled();
		});

		it('stores an editor’s note in the contact’s organization, written by the caller', async () => {
			as([PermissionsEnum.ORG_CONTACT_EDIT]);

			await service.create(note({ employeeId: 'employee-colleague' } as Partial<ICommentCreateInput>));

			expect(policy.findAccessibleParent).toHaveBeenCalledWith(CONTACT_ID);
			expect(baseCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					entity: CONTACT,
					entityId: CONTACT_ID,
					employeeId: 'employee-me',
					organizationId: 'organization-of-contact'
				})
			);
		});

		it('keeps a reply in the contact’s thread', async () => {
			as([PermissionsEnum.ORG_CONTACT_EDIT]);

			await expect(service.create(note({ parentId: NOTE }))).resolves.toBeDefined();
			await expect(service.create(note({ parentId: OTHER_CONTACT_NOTE }))).rejects.toBeInstanceOf(
				BadRequestException
			);
			await expect(service.create(note({ parentId: PROJECT_COMMENT }))).rejects.toBeInstanceOf(
				BadRequestException
			);
			await expect(
				service.create(note({ parentId: '99999999-9999-4999-8999-999999999999' }))
			).rejects.toBeInstanceOf(NotFoundException);
		});

		it('refuses a comment of another record that replies to a note, which would carry the note out', async () => {
			as([PermissionsEnum.ORG_CONTACT_EDIT]);

			await expect(
				service.create(note({ entity: PROJECT, entityId: PROJECT_ID, parentId: NOTE }))
			).rejects.toBeInstanceOf(BadRequestException);
		});
	});

	describe('the comments of every other record keep today’s rules', () => {
		it('posts a project comment as before: no permission asked, the stated organization kept', async () => {
			as([]);

			await service.create(note({ entity: PROJECT, entityId: PROJECT_ID }));

			expect(hasAnyPermission).not.toHaveBeenCalled();
			expect(baseCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					entity: PROJECT,
					entityId: PROJECT_ID,
					organizationId: 'organization-stated'
				})
			);
		});

		it('posts a project reply as before, to a project comment or to a parent it cannot find', async () => {
			as([]);

			await expect(
				service.create(note({ entity: PROJECT, entityId: PROJECT_ID, parentId: PROJECT_COMMENT }))
			).resolves.toBeDefined();
			await expect(
				service.create(
					note({ entity: PROJECT, entityId: PROJECT_ID, parentId: '99999999-9999-4999-8999-999999999999' })
				)
			).resolves.toBeDefined();
		});

		it('lists project comments with the base scope, the added exclusion being always true for them', async () => {
			as([]);
			const findAll = jest
				.spyOn(TenantAwareCrudService.prototype, 'findAll')
				.mockResolvedValue({ items: [], total: 0 });

			await service.findAll({ where: { entity: PROJECT, entityId: PROJECT_ID }, take: 10 } as any);

			expect(findAll).toHaveBeenCalledWith({
				where: { entity: And(Equal(PROJECT), Not(In([CONTACT]))), entityId: PROJECT_ID },
				take: 10
			});
			expect(withoutEmployeeFilter).not.toHaveBeenCalled();
			expect(hasAnyPermission).not.toHaveBeenCalled();
		});

		it('reads one project comment exactly as findOneByIdString does', async () => {
			as([]);

			await service.findReadableById(PROJECT_COMMENT, { relations: ['employee'] } as any);

			expect(findOne).toHaveBeenLastCalledWith(PROJECT_COMMENT, { relations: ['employee'] });
			expect(hasAnyPermission).not.toHaveBeenCalled();
		});

		it('edits and removes a project comment with no permission asked', async () => {
			as([]);
			jest.spyOn(TenantAwareCrudService.prototype, 'delete').mockResolvedValue({ affected: 1, raw: [] });

			await service.update(PROJECT_COMMENT, { comment: 'edited' });
			await service.delete(PROJECT_COMMENT);

			expect(hasAnyPermission).not.toHaveBeenCalled();
		});
	});

	describe('reading notes', () => {
		it('lists every note of a contact the caller may view, whoever wrote it', async () => {
			as([PermissionsEnum.ORG_CONTACT_VIEW]);
			const findAll = jest
				.spyOn(TenantAwareCrudService.prototype, 'findAll')
				.mockResolvedValue({ items: [], total: 0 });
			const filter = { where: { entity: CONTACT, entityId: CONTACT_ID }, order: { createdAt: 'DESC' } };

			await service.findAll(filter as any);

			expect(policy.findAccessibleParent).toHaveBeenCalledWith(CONTACT_ID);
			expect(findAll).toHaveBeenCalledWith(filter);
			expect(withoutEmployeeFilter).toHaveBeenCalledTimes(1);
		});

		it('refuses with 403 a list of notes to a caller who may not view contacts', async () => {
			as([PermissionsEnum.ORG_CONTACT_EDIT]);
			const findAll = jest.spyOn(TenantAwareCrudService.prototype, 'findAll');

			await expect(
				service.findAll({ where: { entity: CONTACT, entityId: CONTACT_ID } } as any)
			).rejects.toBeInstanceOf(ForbiddenException);
			expect(findAll).not.toHaveBeenCalled();
		});

		it('answers 404 for the notes of a contact the caller does not reach', async () => {
			as([PermissionsEnum.ORG_CONTACT_VIEW]);

			await expect(
				service.countBy({ entity: CONTACT, entityId: FOREIGN_CONTACT_ID } as any)
			).rejects.toBeInstanceOf(NotFoundException);
		});

		it('leaves notes out of every list and count that does not name a contact', async () => {
			as([PermissionsEnum.ORG_CONTACT_VIEW]);
			const countBy = jest.spyOn(TenantAwareCrudService.prototype, 'countBy').mockResolvedValue(0);
			const paginate = jest
				.spyOn(TenantAwareCrudService.prototype, 'paginate')
				.mockResolvedValue({ items: [], total: 0 });
			const find = jest.spyOn(TenantAwareCrudService.prototype, 'find').mockResolvedValue([]);
			const count = jest.spyOn(TenantAwareCrudService.prototype, 'count').mockResolvedValue(0);

			await service.countBy();
			await service.paginate({ where: { parentId: NOTE } } as any);
			await service.find();
			await service.count({ where: [] } as any);

			expect(countBy).toHaveBeenCalledWith({ entity: Not(In([CONTACT])) });
			expect(paginate).toHaveBeenCalledWith({ where: { parentId: NOTE, entity: Not(In([CONTACT])) } });
			expect(find).toHaveBeenCalledWith({ where: { entity: Not(In([CONTACT])) } });
			expect(count).toHaveBeenCalledWith({ where: [{ entity: Not(In([CONTACT])) }] });
			expect(withoutEmployeeFilter).not.toHaveBeenCalled();
		});

		it('reads one note for a caller who may view the contact, whoever wrote it', async () => {
			as([PermissionsEnum.ORG_CONTACT_VIEW]);

			await expect(service.findReadableById(NOTE, {} as any)).resolves.toEqual(
				expect.objectContaining({ id: NOTE })
			);
			expect(policy.findAccessibleParent).toHaveBeenCalledWith(CONTACT_ID);
		});

		it('refuses one note to a caller who may not view contacts', async () => {
			as([]);

			await expect(service.findReadableById(NOTE, {} as any)).rejects.toBeInstanceOf(ForbiddenException);
		});
	});

	describe('editing and removing notes', () => {
		beforeEach(() => {
			jest.spyOn(CrudService.prototype, 'softRemove').mockResolvedValue({ deletedAt: new Date() } as never);
			jest.spyOn(TenantAwareCrudService.prototype, 'delete').mockResolvedValue({ affected: 1, raw: [] });
		});

		it('refuses the author’s own edit and removal without ORG_CONTACT_EDIT', async () => {
			as([PermissionsEnum.ORG_CONTACT_VIEW]);

			await expect(service.update(OWN_NOTE, { comment: 'edited' })).rejects.toBeInstanceOf(ForbiddenException);
			await expect(service.softRemove(OWN_NOTE)).rejects.toBeInstanceOf(ForbiddenException);
			await expect(service.delete(OWN_NOTE)).rejects.toBeInstanceOf(ForbiddenException);
			expect(baseCreate).not.toHaveBeenCalled();
		});

		it('lets an author holding ORG_CONTACT_EDIT edit and remove their own note, and still no one else’s', async () => {
			as([PermissionsEnum.ORG_CONTACT_EDIT]);

			await expect(service.update(OWN_NOTE, { comment: 'edited' })).resolves.toBeDefined();
			await expect(service.delete(OWN_NOTE)).resolves.toEqual({ affected: 1, raw: [] });
			await expect(service.delete(NOTE)).rejects.toBeInstanceOf(NotFoundException);
		});

		it('holds a caller who may act for other employees to ORG_CONTACT_EDIT too', async () => {
			as([], { canChangeSelectedEmployee: true });
			await expect(service.softRemove(NOTE)).rejects.toBeInstanceOf(ForbiddenException);

			as([PermissionsEnum.ORG_CONTACT_EDIT], { canChangeSelectedEmployee: true });
			await expect(service.softRemove(NOTE)).resolves.toBeDefined();
		});

		it('keeps a note in its thread when an edit makes it a reply', async () => {
			as([PermissionsEnum.ORG_CONTACT_EDIT]);

			await expect(service.update(OWN_NOTE, { parentId: PROJECT_COMMENT } as any)).rejects.toBeInstanceOf(
				BadRequestException
			);
			await expect(service.update(OWN_NOTE, { parentId: NOTE } as any)).resolves.toBeDefined();
		});

		it('keeps an edited note on its contact and in its organization, whatever the edit states', async () => {
			as([PermissionsEnum.ORG_CONTACT_EDIT]);

			await service.update(OWN_NOTE, {
				comment: 'edited',
				organizationId: 'organization-elsewhere',
				organization: { id: 'organization-elsewhere' },
				entity: PROJECT,
				entityId: PROJECT_ID
			} as any);

			const written = baseCreate.mock.calls[0][0];
			expect(written).toEqual(
				expect.objectContaining({ id: OWN_NOTE, comment: 'edited', organizationId: 'organization-of-contact' })
			);
			expect(written).not.toHaveProperty('organization');
			expect(written).not.toHaveProperty('entity');
			expect(written).not.toHaveProperty('entityId');
		});

		it('refuses to move a project comment onto a contact, in any spelling', async () => {
			as([PermissionsEnum.ORG_CONTACT_EDIT]);

			for (const entity of [CONTACT, 'organizationcontact']) {
				await expect(
					service.update(PROJECT_COMMENT, { entity, entityId: CONTACT_ID } as any)
				).rejects.toBeInstanceOf(BadRequestException);
			}
			expect(baseCreate).not.toHaveBeenCalled();
		});

		it('still lets a project comment’s edit state its organization, as before', async () => {
			as([]);

			await service.update(PROJECT_COMMENT, { comment: 'edited', organizationId: 'organization-stated' } as any);

			expect(baseCreate).toHaveBeenCalledWith(
				expect.objectContaining({ id: PROJECT_COMMENT, organizationId: 'organization-stated' })
			);
		});
	});

	describe('another spelling of the contact type', () => {
		/** The refusal of the type check itself, not the 400 every unexpected failure of a create becomes. */
		const CANONICAL_ONLY = `states its entity as "${CONTACT}"`;

		it.each(['organizationcontact', 'ORGANIZATIONCONTACT', 'Organization Contact', 'OrganizationContact '])(
			'refuses a new comment on %p, which MySQL would list with the contact’s notes',
			async (entity) => {
				as([PermissionsEnum.ORG_CONTACT_EDIT]);

				const refusal = service.create(note({ entity: entity as BaseEntityEnum }));

				await expect(refusal).rejects.toBeInstanceOf(BadRequestException);
				await expect(refusal).rejects.toThrow(CANONICAL_ONLY);
				expect(policy.findAccessibleParent).not.toHaveBeenCalled();
				expect(baseCreate).not.toHaveBeenCalled();
			}
		);

		it('refuses it from the GraphQL createComment mutation through to the service', async () => {
			as([PermissionsEnum.ORG_CONTACT_EDIT]);
			const handler = new CommentCreateHandler(service);
			const commandBus = { execute: jest.fn((command) => handler.execute(command)) };
			const resolver = new CommentResolver(service, commandBus as never);

			const refusal = resolver.createComment({
				comment: 'A note under another spelling',
				entity: 'organizationcontact',
				entityId: CONTACT_ID,
				organizationId: 'organization-stated'
			} as any);

			await expect(refusal).rejects.toBeInstanceOf(BadRequestException);
			await expect(refusal).rejects.toThrow(CANONICAL_ONLY);
			expect(commandBus.execute).toHaveBeenCalledTimes(1);
			expect(baseCreate).not.toHaveBeenCalled();
		});

		it('reads a stored note of another spelling under the contact policy', async () => {
			as([]);
			await expect(service.findReadableById(LOOKALIKE_NOTE, {} as any)).rejects.toBeInstanceOf(
				ForbiddenException
			);

			as([PermissionsEnum.ORG_CONTACT_VIEW]);
			await expect(service.findReadableById(LOOKALIKE_NOTE, {} as any)).resolves.toEqual(
				expect.objectContaining({ id: LOOKALIKE_NOTE })
			);
			expect(policy.findAccessibleParent).toHaveBeenCalledWith(CONTACT_ID);
		});

		it('lists the notes of a contact named in another spelling only for those who may view it', async () => {
			jest.spyOn(TenantAwareCrudService.prototype, 'findAll').mockResolvedValue({ items: [], total: 0 });
			const where = { entity: 'organizationcontact', entityId: CONTACT_ID };

			as([]);
			await expect(service.findAll({ where } as any)).rejects.toBeInstanceOf(ForbiddenException);

			as([PermissionsEnum.ORG_CONTACT_VIEW]);
			await expect(service.findAll({ where } as any)).resolves.toEqual({ items: [], total: 0 });
			expect(policy.findAccessibleParent).toHaveBeenCalledWith(CONTACT_ID);
		});

		it('edits a stored note of another spelling only with ORG_CONTACT_EDIT', async () => {
			as([PermissionsEnum.ORG_CONTACT_VIEW], { canChangeSelectedEmployee: true });

			await expect(service.update(LOOKALIKE_NOTE, { comment: 'edited' })).rejects.toBeInstanceOf(
				ForbiddenException
			);
		});
	});

	describe('a governed record’s organization on create', () => {
		it('stores a note in the contact’s organization, and drops an organization relation the body states', async () => {
			as([PermissionsEnum.ORG_CONTACT_EDIT]);

			await service.create(note({ organization: { id: 'organization-elsewhere' } } as any));

			const written = baseCreate.mock.calls[0][0];
			expect(written.organizationId).toBe('organization-of-contact');
			expect(written).not.toHaveProperty('organization');
		});

		it('keeps a project comment’s stated organization relation, as before', async () => {
			as([]);

			await service.create(
				note({ entity: PROJECT, entityId: PROJECT_ID, organization: { id: 'organization-stated' } } as any)
			);

			expect(baseCreate).toHaveBeenCalledWith(
				expect.objectContaining({ organization: { id: 'organization-stated' } })
			);
		});
	});

	describe('reading one comment by id', () => {
		it('reads the comment the path names, whatever id the criteria state', async () => {
			as([], { canChangeSelectedEmployee: true });

			// A project comment's id in the path, a note's id in the criteria: the read stays on the project comment.
			await expect(service.findReadableById(PROJECT_COMMENT, { where: { id: NOTE } } as any)).resolves.toEqual(
				expect.objectContaining({ id: PROJECT_COMMENT })
			);
			expect(findOne).toHaveBeenLastCalledWith(PROJECT_COMMENT, { where: { id: PROJECT_COMMENT } });
			expect(hasAnyPermission).not.toHaveBeenCalled();
		});

		it('keeps a governed note’s read on the note the path names', async () => {
			as([PermissionsEnum.ORG_CONTACT_VIEW]);

			await service.findReadableById(NOTE, {
				where: { id: PROJECT_COMMENT, employeeId: 'employee-colleague' }
			} as any);

			expect(findOne).toHaveBeenLastCalledWith(NOTE, { where: { id: NOTE, employeeId: 'employee-colleague' } });
		});

		it.each([
			['a list', [{ id: NOTE }]],
			['text', 'id=' + NOTE],
			['a find operator', In([NOTE])]
		])('refuses criteria stated as %s', async (_label, where) => {
			as([], { canChangeSelectedEmployee: true });

			await expect(service.findReadableById(PROJECT_COMMENT, { where } as any)).rejects.toBeInstanceOf(
				BadRequestException
			);
		});
	});

	describe('lifting the employee filter', () => {
		it('lifts it inside a request-context store of its own, every time', async () => {
			as([PermissionsEnum.ORG_CONTACT_VIEW, PermissionsEnum.ORG_CONTACT_EDIT]);
			const order: string[] = [];
			const runIsolated = jest.spyOn(RequestContext, 'runIsolated').mockImplementation((work) => {
				order.push('isolated');
				return work();
			});
			withoutEmployeeFilter.mockImplementation((read: () => Promise<unknown>) => {
				order.push('without-employee-filter');
				return read();
			});
			jest.spyOn(TenantAwareCrudService.prototype, 'findAll').mockResolvedValue({ items: [], total: 0 });

			await service.findAll({ where: { entity: CONTACT, entityId: CONTACT_ID } } as any);
			await service.findReadableById(NOTE, {} as any);
			await service.create(note({ parentId: NOTE }));

			expect(withoutEmployeeFilter.mock.calls.length).toBeGreaterThanOrEqual(4);
			expect(runIsolated).toHaveBeenCalledTimes(withoutEmployeeFilter.mock.calls.length);
			// Every lift opens its own store first.
			expect(order).toEqual(
				Array.from({ length: runIsolated.mock.calls.length }).flatMap(() => [
					'isolated',
					'without-employee-filter'
				])
			);
		});
	});
});
