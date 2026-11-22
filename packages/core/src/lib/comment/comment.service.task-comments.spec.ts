/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service or controller — see
 * `channel.controller.spec.ts` for the cycle it avoids.
 */
import '../core/entities/internal';

import { NotFoundException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { BaseEntityEnum, ICommentCreateInput, PermissionsEnum } from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { RequestContext } from '../core/context/request-context';
import { TaskCommentAccessPolicy } from '../tasks/task-comment-access.policy';
import { CommentService } from './comment.service';
import { CommentParentAccessService, ICommentParent, ICommentParentAccessPolicy } from './parent-access';

/**
 * A task's comments are read by everyone who may read the task, whoever wrote them (ever-co/ever-gauzy#12138).
 *
 * Lucía (the Employee role, no CHANGE_SELECTED_EMPLOYEE) comments on her task, Jonas (an administrator) answers on the
 * same task. The comment API's base scope keeps a caller who may not act for other employees to the rows they wrote,
 * which is what the stand-in store below does unless the employee filter is lifted; before the fix Lucía read `total`
 * 1 and Jonas 2 on the same query. Reads that do not name one task, and every write, keep today's rules.
 */
const TASK = BaseEntityEnum.Task;
const CONTACT = BaseEntityEnum.OrganizationContact;
const PROJECT = BaseEntityEnum.OrganizationProject;

const TASK_ID = '2b3c4d5e-6f70-4812-9a3b-4c5d6e7f8091';
/** A task the caller does not reach: another organization's, or one that does not exist. */
const FOREIGN_TASK_ID = '3c4d5e6f-7081-4923-8b4c-5d6e7f809102';
const PROJECT_ID = '0f1e2d3c-4b5a-4968-8776-655443322110';
const CONTACT_ID = '6d7c4a3e-1b2f-4c5d-8e9f-0a1b2c3d4e5f';

const LUCIA = 'employee-lucia';
const JONAS = 'employee-jonas';

const LUCIA_COMMENT = '11111111-1111-4111-8111-111111111111';
const JONAS_ANSWER = '22222222-2222-4222-8222-222222222222';
const JONAS_WITHDRAWN = '33333333-3333-4333-8333-333333333333';
const JONAS_ON_FOREIGN_TASK = '44444444-4444-4444-8444-444444444444';
const JONAS_ON_PROJECT = '55555555-5555-4555-8555-555555555555';

const IN_ORGANIZATION = { tenantId: 'tenant-1', organizationId: 'organization-1' };

interface IStoredComment {
	id: string;
	tenantId: string;
	organizationId: string;
	entity: string;
	entityId: string;
	employeeId: string;
	deletedAt?: Date;
}

const STORED: IStoredComment[] = [
	{ ...IN_ORGANIZATION, id: LUCIA_COMMENT, entity: TASK, entityId: TASK_ID, employeeId: LUCIA },
	{ ...IN_ORGANIZATION, id: JONAS_ANSWER, entity: TASK, entityId: TASK_ID, employeeId: JONAS },
	{
		...IN_ORGANIZATION,
		id: JONAS_WITHDRAWN,
		entity: TASK,
		entityId: TASK_ID,
		employeeId: JONAS,
		deletedAt: new Date('2026-11-01T00:00:00.000Z')
	},
	{ ...IN_ORGANIZATION, id: JONAS_ON_FOREIGN_TASK, entity: TASK, entityId: FOREIGN_TASK_ID, employeeId: JONAS },
	{ ...IN_ORGANIZATION, id: JONAS_ON_PROJECT, entity: PROJECT, entityId: PROJECT_ID, employeeId: JONAS }
];

/** Whether a stored value meets a criterion: a value, or the find operators the comment reads state. */
function satisfies(condition: unknown, actual: unknown): boolean {
	if (!(condition instanceof FindOperator)) {
		return actual === condition;
	}
	switch (condition.type) {
		case 'not':
			return !satisfies(condition.child ?? condition.value, actual);
		case 'and':
			return (condition.value as unknown[]).every((part) => satisfies(part, actual));
		case 'equal':
			return actual === condition.value;
		case 'in':
			return (condition.value as unknown[]).includes(actual);
		case 'isNull':
			return actual == null;
		default:
			throw new Error(`The stand-in store has no rule for ${condition.type}`);
	}
}

describe('CommentService — a task’s comments are read by everyone who may read the task', () => {
	let service: CommentService;
	let taskService: { findOneByIdString: jest.Mock };
	let employeeFilterLifted: number;
	let baseCreate: jest.SpyInstance;

	/** The caller: their own employee, their permissions, and whether they may act for other employees. */
	const as = (employeeId: string, permissions: PermissionsEnum[], { canChangeSelectedEmployee = false } = {}) => {
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(
			(canChangeSelectedEmployee ? null : employeeId) as never
		);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: `user-of-${employeeId}`, employeeId } as never);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(`user-of-${employeeId}` as never);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1' as never);
		jest.spyOn(RequestContext, 'hasRoles').mockReturnValue(false);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
			(permission: PermissionsEnum) =>
				(canChangeSelectedEmployee && permission === PermissionsEnum.CHANGE_SELECTED_EMPLOYEE) ||
				permissions.includes(permission)
		);
		jest.spyOn(RequestContext, 'hasAnyPermission').mockImplementation((wanted: PermissionsEnum[]) =>
			wanted.some((permission) => permissions.includes(permission))
		);
	};
	const asLucia = () => as(LUCIA, [PermissionsEnum.ORG_TASK_VIEW]);
	const asJonas = () => as(JONAS, [PermissionsEnum.ALL_ORG_VIEW], { canChangeSelectedEmployee: true });

	/** The author the base scope keeps the caller to: none once the filter is lifted, or for those who act for others. */
	const authorScope = (): string | undefined => {
		const actsForOthers = RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);
		if (employeeFilterLifted > 0 || actsForOthers) {
			return undefined;
		}
		return RequestContext.currentEmployeeId() ?? undefined;
	};

	/** The stored comments a base read answers: its criteria, the live rows unless it asks for withdrawn ones, and the author scope. */
	const baseRows = (where: unknown, withDeleted?: unknown): IStoredComment[] => {
		const alternatives = (Array.isArray(where) ? where : [where ?? {}]) as Record<string, unknown>[];
		const author = authorScope();
		return STORED.filter((row) => {
			const live = withDeleted === true || !row.deletedAt;
			const ownedWhenScoped = author === undefined || row.employeeId === author;
			const meetsCriteria = alternatives.some((alternative) =>
				Object.entries(alternative).every(([column, condition]) =>
					satisfies(condition, (row as unknown as Record<string, unknown>)[column])
				)
			);
			return live && ownedWhenScoped && meetsCriteria;
		});
	};
	const idsOf = (rows: Array<{ id?: string }>) => rows.map((row) => row.id);

	const comment = (overrides: Partial<ICommentCreateInput> = {}): ICommentCreateInput =>
		({
			comment: 'The east stairwell exit is missing on the map',
			entity: TASK,
			entityId: TASK_ID,
			organizationId: 'organization-1',
			...overrides
		}) as ICommentCreateInput;

	beforeEach(() => {
		employeeFilterLifted = 0;
		taskService = {
			findOneByIdString: jest.fn(async (id: string) => {
				if (id !== TASK_ID) {
					throw new NotFoundException('The requested record was not found');
				}
				return { id, organizationId: 'organization-1' };
			})
		};
		const contactPolicy: ICommentParentAccessPolicy = {
			entity: CONTACT,
			readPermissions: [PermissionsEnum.ORG_CONTACT_VIEW],
			writePermissions: [PermissionsEnum.ORG_CONTACT_EDIT],
			findAccessibleParent: jest.fn(async (id: string): Promise<ICommentParent> => ({ id, organizationId: null }))
		};
		const parentAccess = new CommentParentAccessService();
		parentAccess.register(contactPolicy);
		parentAccess.register(new TaskCommentAccessPolicy(taskService as never));

		service = Object.create(CommentService.prototype);
		Object.assign(service as any, {
			_parentAccess: parentAccess,
			_employeeService: { findOneByIdString: jest.fn(async (id: string) => ({ id })) },
			_mentionService: { publishMention: jest.fn(), updateEntityMentions: jest.fn() },
			_eventBus: { publish: jest.fn() },
			withoutEmployeeFilter: jest.fn(async (read: () => Promise<unknown>) => {
				employeeFilterLifted++;
				try {
					return await read();
				} finally {
					employeeFilterLifted--;
				}
			}),
			withoutOrganizationBoundary: jest.fn((read: () => Promise<unknown>) => read()),
			findOneByIdString: jest.fn(
				async (id: string, options?: { where?: Record<string, unknown>; withDeleted?: boolean }) => {
					const [row] = baseRows({ ...(options?.where ?? {}), id }, options?.withDeleted);
					if (!row) {
						throw new NotFoundException('The requested record was not found');
					}
					return { ...row };
				}
			),
			findOneByWhereOptions: jest.fn(async (where: Record<string, unknown>) => baseRows(where)[0] ?? null)
		});

		jest.spyOn(TenantAwareCrudService.prototype, 'findAll').mockImplementation(async (filter) => {
			const items = baseRows(filter?.where, filter?.withDeleted);
			return { items, total: items.length } as never;
		});
		jest.spyOn(TenantAwareCrudService.prototype, 'paginate').mockImplementation(async (filter) => {
			const items = baseRows(filter?.where, filter?.withDeleted);
			return { items, total: items.length } as never;
		});
		jest.spyOn(TenantAwareCrudService.prototype, 'find').mockImplementation(
			async (filter) => baseRows(filter?.where, filter?.withDeleted) as never
		);
		jest.spyOn(TenantAwareCrudService.prototype, 'count').mockImplementation(
			async (filter) => baseRows(filter?.where, filter?.withDeleted).length
		);
		jest.spyOn(TenantAwareCrudService.prototype, 'countBy').mockImplementation(
			async (where) => baseRows(where).length
		);
		baseCreate = jest
			.spyOn(TenantAwareCrudService.prototype, 'create')
			.mockImplementation(async (input) => ({ id: 'new-comment', ...input }) as never);
	});

	afterEach(() => jest.restoreAllMocks());

	const ofTask = (taskId = TASK_ID) => ({ entity: TASK, entityId: taskId, ...IN_ORGANIZATION });

	describe('a member who may read the task', () => {
		it('reads the administrator’s answer beside her own comment, with the administrator’s total', async () => {
			asJonas();
			const jonasReads = await service.findAll({ where: ofTask(), take: 100 } as never);
			asLucia();
			const luciaReads = await service.findAll({ where: ofTask(), take: 100 } as never);

			expect(idsOf(luciaReads.items)).toEqual([LUCIA_COMMENT, JONAS_ANSWER]);
			expect(luciaReads.total).toBe(2);
			expect(luciaReads.total).toBe(jonasReads.total);
			expect(taskService.findOneByIdString).toHaveBeenCalledWith(TASK_ID);
		});

		it('counts them the same way on every list and count read', async () => {
			asLucia();

			await expect(service.countBy(ofTask() as never)).resolves.toBe(2);
			await expect(service.count({ where: ofTask() } as never)).resolves.toBe(2);
			await expect(service.find({ where: ofTask() } as never)).resolves.toHaveLength(2);
			await expect(service.paginate({ where: ofTask(), take: 10 } as never)).resolves.toEqual(
				expect.objectContaining({ total: 2 })
			);
		});

		it('reads the administrator’s answer by its id', async () => {
			asLucia();

			await expect(service.findReadableById(JONAS_ANSWER, {} as never)).resolves.toEqual(
				expect.objectContaining({ id: JONAS_ANSWER })
			);
		});

		it('keeps withdrawn comments to their author, as before', async () => {
			asLucia();
			const withdrawnToo = await service.findAll({ where: ofTask(), withDeleted: true } as never);

			expect(idsOf(withdrawnToo.items)).toEqual([LUCIA_COMMENT]);
			await expect(
				service.findReadableById(JONAS_WITHDRAWN, { withDeleted: true } as never)
			).rejects.toBeInstanceOf(NotFoundException);
		});
	});

	describe('a caller who may not read the task reads no one else’s comment on it', () => {
		it('without a task read permission', async () => {
			as(LUCIA, []);

			const list = await service.findAll({ where: ofTask() } as never);

			expect(idsOf(list.items)).toEqual([LUCIA_COMMENT]);
			await expect(service.countBy(ofTask() as never)).resolves.toBe(1);
			await expect(service.findReadableById(JONAS_ANSWER, {} as never)).rejects.toBeInstanceOf(NotFoundException);
			expect(taskService.findOneByIdString).not.toHaveBeenCalled();
		});

		it('on a task the task read does not find: another organization’s, or none', async () => {
			asLucia();

			const list = await service.findAll({ where: ofTask(FOREIGN_TASK_ID) } as never);

			expect(list.total).toBe(0);
			await expect(service.findReadableById(JONAS_ON_FOREIGN_TASK, {} as never)).rejects.toBeInstanceOf(
				NotFoundException
			);
		});

		it('when one alternative of the read names a task out of reach', async () => {
			asLucia();

			const list = await service.findAll({ where: [ofTask(), ofTask(FOREIGN_TASK_ID)] } as never);

			expect(idsOf(list.items)).toEqual([LUCIA_COMMENT]);
		});
	});

	describe('reads that do not name one task keep today’s answers', () => {
		it.each([
			['no criteria', undefined],
			['every task', { entity: TASK }],
			['an author', { employeeId: JONAS }],
			['a project', { entity: PROJECT, entityId: PROJECT_ID }]
		])('a member’s read of %s', async (_label, where) => {
			asLucia();

			const list = await service.findAll({ where } as never);

			expect(list.items.every((row: { employeeId?: string }) => row.employeeId === LUCIA)).toBe(true);
			expect(taskService.findOneByIdString).not.toHaveBeenCalled();
			expect((service as any).withoutEmployeeFilter).not.toHaveBeenCalled();
		});
	});

	describe('writes keep today’s rules', () => {
		it('still lets a member post on a task without a task read, and stores the stated organization', async () => {
			as(LUCIA, []);

			await service.create(comment({ entityId: FOREIGN_TASK_ID }));

			expect(baseCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					entityId: FOREIGN_TASK_ID,
					employeeId: LUCIA,
					organizationId: 'organization-1'
				})
			);
			expect(taskService.findOneByIdString).not.toHaveBeenCalled();
		});

		it('still refuses a member’s edit and removal of the administrator’s comment', async () => {
			asLucia();
			jest.spyOn(TenantAwareCrudService.prototype, 'delete').mockResolvedValue({ affected: 1, raw: [] });
			jest.spyOn(TenantAwareCrudService.prototype, 'softRemove').mockResolvedValue({ id: JONAS_ANSWER } as never);

			await expect(service.update(JONAS_ANSWER, { comment: 'Changed' } as never)).rejects.toThrow(
				`Comment with id ${JONAS_ANSWER} not found`
			);
			await expect(service.softRemove(JONAS_ANSWER)).rejects.toBeInstanceOf(NotFoundException);
			await expect(service.delete(JONAS_ANSWER)).rejects.toBeInstanceOf(NotFoundException);
			expect(baseCreate).not.toHaveBeenCalled();
		});
	});
});
