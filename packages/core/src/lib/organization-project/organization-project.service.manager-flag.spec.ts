import '../core/entities/internal';

import { Brackets } from 'typeorm';
import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { CrudService, TenantAwareCrudService } from '../core/crud';
import { MultiORMEnum } from '../core/utils';
import { OrganizationProjectService } from './organization-project.service';

/**
 * `isManager` on a project membership is what ManagedEmployeeService and the tracked-data guard read to let a
 * manager act for the project's members: their time-tracking statistics and activity. An EMPLOYEE holds
 * ORG_PROJECT_ADD by default, names any colleagues of the organization as members of a project they create, and
 * is made that project's manager automatically, so setting the flag there let any employee give themselves the
 * manager's reach over those colleagues. The team twin was closed by ever-co/ever-gauzy#11197.
 *
 * The flag is now written only by a caller holding CHANGE_SELECTED_EMPLOYEE (Admin / Super Admin), who may already
 * act for every employee. Anyone else gives the MANAGER role alone, never raises the flag, and clears it with the
 * role. The role alone still makes a project manager for editing the project (`isManagerOfProject`, read by
 * ProjectManagerOrPermissionGuard), so an employee keeps editing the project they created.
 */

const TENANT = 'tenant-1';
const ORGANIZATION = 'organization-1';
const managerRole = { id: 'role-manager', name: RolesEnum.MANAGER };

let permissions: PermissionsEnum[];

beforeEach(() => {
	permissions = [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE];
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
	jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(null);
	jest.spyOn(RequestContext, 'currentRoleId').mockReturnValue('role-admin');
	jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission: PermissionsEnum) =>
		permissions.includes(permission)
	);
});

afterEach(() => {
	jest.restoreAllMocks();
});

/** An EMPLOYEE caller: ORG_PROJECT_ADD by default, no CHANGE_SELECTED_EMPLOYEE. */
const actAsEmployee = (employeeId: string) => {
	permissions = [PermissionsEnum.ORG_PROJECT_ADD, PermissionsEnum.ORG_PROJECT_VIEW];
	jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(employeeId);
	jest.spyOn(RequestContext, 'currentRoleId').mockReturnValue('role-employee');
};

describe('OrganizationProjectService.create — manager flag on the members', () => {
	let saved: Record<string, any>;
	let service: OrganizationProjectService;

	beforeEach(() => {
		saved = undefined;
		jest.spyOn(TenantAwareCrudService.prototype, 'create').mockImplementation(async (entity) => {
			saved = entity;
			return { id: 'project-1', name: 'Project', ...entity } as never;
		});

		service = Object.create(OrganizationProjectService.prototype);
		Object.assign(service, {
			_roleService: {
				// The caller is not an EMPLOYEE, so it is not added as a manager
				findOneByIdString: jest.fn().mockRejectedValue(new Error('not found')),
				findOneByWhereOptions: jest.fn().mockResolvedValue(managerRole)
			},
			_employeeService: {
				findActiveEmployeesByEmployeeIds: jest
					.fn()
					.mockImplementation(async (ids: string[]) => ids.map((id: string) => ({ id })))
			},
			_eventBus: { publish: jest.fn() },
			_activityLogService: { logActivity: jest.fn() }
		});
	});

	/** The members the create saved, as employee, flag and role. */
	const savedMembers = () =>
		saved.members.map(({ employeeId, isManager, role }) => ({ employeeId, isManager, role }));

	it('flags the managers and only them for a caller holding CHANGE_SELECTED_EMPLOYEE', async () => {
		await service.create({
			name: 'Project',
			organizationId: ORGANIZATION,
			managerIds: ['manager-employee'],
			memberIds: ['member-employee']
		} as any);

		expect(savedMembers()).toEqual(
			expect.arrayContaining([
				{ employeeId: 'manager-employee', isManager: true, role: managerRole },
				{ employeeId: 'member-employee', isManager: false, role: null }
			])
		);
		expect(saved.members).toHaveLength(2);
	});

	it('does not flag the managers of a project an employee creates, who keep the MANAGER role', async () => {
		actAsEmployee('creator-employee');
		(service as any)._roleService.findOneByIdString.mockResolvedValue({
			id: 'role-employee',
			name: RolesEnum.EMPLOYEE
		});

		await service.create({
			name: 'Project',
			organizationId: ORGANIZATION,
			managerIds: ['co-manager-employee'],
			memberIds: ['colleague-employee']
		} as any);

		expect(savedMembers()).toEqual(
			expect.arrayContaining([
				// The creator is still made a manager of their project, by the role
				{ employeeId: 'creator-employee', isManager: false, role: managerRole },
				{ employeeId: 'co-manager-employee', isManager: false, role: managerRole },
				{ employeeId: 'colleague-employee', isManager: false, role: null }
			])
		);
		expect(saved.members).toHaveLength(3);
		expect(saved.members.some((member) => member.isManager)).toBe(false);
	});
});

describe('OrganizationProjectService.updateOrganizationProjectMembers — manager flag', () => {
	/** The service's collaborators, over the given existing member rows. */
	function harness(existing: Array<Record<string, any>>) {
		return {
			_roleService: { findOneByWhereOptions: jest.fn().mockResolvedValue(managerRole) },
			typeOrmOrganizationProjectEmployeeRepository: {
				find: jest.fn().mockResolvedValue(existing),
				update: jest.fn(),
				save: jest.fn()
			},
			deleteMemberByIds: jest.fn(),
			_entitySubscriptionService: { deleteForEmployee: jest.fn() },
			_eventBus: { publish: jest.fn() }
		};
	}

	const run = (self: ReturnType<typeof harness>, employees: string[], managerIds: string[], memberIds: string[]) =>
		OrganizationProjectService.prototype.updateOrganizationProjectMembers.call(
			self,
			'project-1',
			ORGANIZATION,
			TENANT,
			employees.map((id: string) => ({ id })),
			managerIds,
			memberIds
		);

	/** The update the edit wrote for one member row, or `undefined` when it left the row alone. */
	const updateOf = (self: ReturnType<typeof harness>, rowId: string) =>
		self.typeOrmOrganizationProjectEmployeeRepository.update.mock.calls.find(([id]) => id === rowId)?.[1];

	/** The new member rows the edit saved, as employee, flag and role. */
	const savedNew = (self: ReturnType<typeof harness>) =>
		(self.typeOrmOrganizationProjectEmployeeRepository.save.mock.calls[0]?.[0] ?? []).map(
			({ employeeId, isManager, roleId }) => ({ employeeId, isManager, roleId })
		);

	describe('a caller holding CHANGE_SELECTED_EMPLOYEE', () => {
		it('flags a new manager, promotes a member with the flag and repairs a manager row that lacks it', async () => {
			const self = harness([
				{ id: 'row-member', employeeId: 'member', roleId: null, isManager: false },
				{ id: 'row-unflagged', employeeId: 'unflagged', roleId: managerRole.id, isManager: false }
			]);

			await run(self, ['member', 'unflagged', 'newcomer'], ['member', 'unflagged', 'newcomer'], []);

			expect(updateOf(self, 'row-member')).toEqual({ role: managerRole, isManager: true });
			expect(updateOf(self, 'row-unflagged')).toEqual({ role: managerRole, isManager: true });
			expect(savedNew(self)).toEqual([{ employeeId: 'newcomer', isManager: true, roleId: managerRole.id }]);
		});
	});

	describe('a caller without CHANGE_SELECTED_EMPLOYEE (a project manager editing their project)', () => {
		beforeEach(() => actAsEmployee('creator'));

		it('gives a new manager the MANAGER role without the flag', async () => {
			const self = harness([]);

			await run(self, ['newcomer', 'colleague'], ['newcomer'], ['colleague']);

			expect(savedNew(self)).toEqual([
				{ employeeId: 'newcomer', isManager: false, roleId: managerRole.id },
				{ employeeId: 'colleague', isManager: false, roleId: null }
			]);
		});

		it('promotes an existing member to the MANAGER role without raising the flag', async () => {
			const self = harness([{ id: 'row-member', employeeId: 'member', roleId: null, isManager: false }]);

			await run(self, ['member'], ['member'], []);

			expect(updateOf(self, 'row-member')).toEqual({ role: managerRole, isManager: false });
		});

		it('does not raise the flag on a manager row that lacks it', async () => {
			// The creator of an employee-made project: the MANAGER role, no flag. Restating them as a manager
			// must not hand them the flag the create withheld.
			const self = harness([
				{ id: 'row-creator', employeeId: 'creator', roleId: managerRole.id, isManager: false }
			]);

			await run(self, ['creator'], ['creator'], []);

			expect(updateOf(self, 'row-creator')).toBeUndefined();
		});

		it('keeps the flag of a manager an administrator flagged', async () => {
			const self = harness([
				{ id: 'row-flagged', employeeId: 'flagged', roleId: managerRole.id, isManager: true }
			]);

			await run(self, ['flagged'], ['flagged'], []);

			expect(updateOf(self, 'row-flagged')).toBeUndefined();
		});

		it('clears the flag together with the MANAGER role when a manager is made a member', async () => {
			const self = harness([
				{ id: 'row-flagged', employeeId: 'flagged', roleId: managerRole.id, isManager: true }
			]);

			await run(self, ['flagged'], [], ['flagged']);

			expect(updateOf(self, 'row-flagged')).toEqual({ role: null, isManager: false });
		});

		it('leaves a plain member that needs no change alone', async () => {
			const self = harness([{ id: 'row-member', employeeId: 'member', roleId: null, isManager: false }]);

			await run(self, ['member'], [], ['member']);

			expect(self.typeOrmOrganizationProjectEmployeeRepository.update).not.toHaveBeenCalled();
		});
	});
});

describe('OrganizationProjectService.update — membership rows are not saved from the body', () => {
	it('drops a stated membership row, so the flag it carries reaches no save', async () => {
		// PUT /organization-projects/:id from a role-only manager, stating their own membership with the flag.
		actAsEmployee('employee-me');
		let saved: Record<string, any>;
		jest.spyOn(TenantAwareCrudService.prototype, 'findOneByIdString').mockResolvedValue({
			id: 'project-1'
		} as never);
		jest.spyOn(TenantAwareCrudService.prototype, 'create').mockImplementation(async (entity) => {
			saved = entity;
			return { id: 'project-1', name: 'Project', ...entity } as never;
		});
		const updateOrganizationProjectMembers = jest.fn();
		const service = Object.create(OrganizationProjectService.prototype);
		Object.assign(service, { _activityLogService: { logActivity: jest.fn() }, updateOrganizationProjectMembers });

		await service.update('project-1', {
			name: 'Renamed',
			organizationId: ORGANIZATION,
			members: [{ id: 'membership-me', employeeId: 'employee-me', isManager: true }]
		} as never);

		expect(saved).not.toHaveProperty('members');
		expect(saved).toMatchObject({
			id: 'project-1',
			name: 'Renamed',
			organizationId: ORGANIZATION,
			tenantId: TENANT
		});
		// No memberIds / managerIds: the gated helper does not run, and nothing else writes a membership.
		expect(updateOrganizationProjectMembers).not.toHaveBeenCalled();
	});
});

describe('OrganizationProjectService.isManagerOfProject — the flag or the MANAGER role', () => {
	it('TypeORM: matches an active member flagged isManager or holding the MANAGER role', async () => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);

		const calls: Array<[string, ...unknown[]]> = [];
		const queryBuilder: Record<string, jest.Mock> = {};
		for (const method of ['innerJoin', 'leftJoin', 'where', 'andWhere']) {
			queryBuilder[method] = jest.fn((...args: unknown[]) => {
				calls.push([method, ...args]);
				return queryBuilder;
			});
		}
		queryBuilder.getOne = jest.fn().mockResolvedValue({ id: 'project-1' });

		const service = Object.create(OrganizationProjectService.prototype);
		Object.assign(service, { typeOrmRepository: { createQueryBuilder: jest.fn(() => queryBuilder) } });

		await expect(service.isManagerOfProject('project-1', 'employee-1')).resolves.toBe(true);

		expect(calls).toEqual(expect.arrayContaining([['leftJoin', 'members.role', 'memberRole']]));
		// The old criterion, flag alone, is gone from the top level: it is one branch of the brackets now
		expect(calls).not.toEqual(
			expect.arrayContaining([['andWhere', 'members.isManager = :isManager', { isManager: true }]])
		);

		const brackets = calls.find(([method, condition]) => method === 'andWhere' && condition instanceof Brackets);
		expect(brackets).toBeDefined();

		const branches: unknown[][] = [];
		const inner = {
			where: jest.fn((...args: unknown[]) => (branches.push(['where', ...args]), inner)),
			orWhere: jest.fn((...args: unknown[]) => (branches.push(['orWhere', ...args]), inner))
		};
		(brackets[1] as Brackets).whereFactory(inner as any);

		expect(branches).toEqual([
			['where', 'members.isManager = :isManager', { isManager: true }],
			['orWhere', 'memberRole.name = :managerRoleName', { managerRoleName: RolesEnum.MANAGER }]
		]);
		// Still only an active, unarchived membership of the caller in this project
		expect(calls).toEqual(
			expect.arrayContaining([
				['where', 'project.id = :projectId', { projectId: 'project-1' }],
				['andWhere', 'members.employeeId = :employeeId', { employeeId: 'employee-1' }],
				['andWhere', 'members.isActive = :isActive', { isActive: true }],
				['andWhere', 'members.isArchived = :isArchived', { isArchived: false }]
			])
		);
	});

	it('TypeORM: answers false when no membership matches', async () => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);

		const queryBuilder: Record<string, jest.Mock> = {};
		for (const method of ['innerJoin', 'leftJoin', 'where', 'andWhere']) {
			queryBuilder[method] = jest.fn(() => queryBuilder);
		}
		queryBuilder.getOne = jest.fn().mockResolvedValue(null);

		const service = Object.create(OrganizationProjectService.prototype);
		Object.assign(service, { typeOrmRepository: { createQueryBuilder: jest.fn(() => queryBuilder) } });

		await expect(service.isManagerOfProject('project-1', 'employee-1')).resolves.toBe(false);
	});

	it('MikroORM: matches an active member flagged isManager or holding the MANAGER role', async () => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);

		const findOne = jest.fn().mockResolvedValue({ id: 'project-1' });
		const service = Object.create(OrganizationProjectService.prototype);
		Object.assign(service, { mikroOrmRepository: { findOne } });

		await expect(service.isManagerOfProject('project-1', 'employee-1')).resolves.toBe(true);

		expect(findOne).toHaveBeenCalledWith({
			id: 'project-1',
			members: {
				employeeId: 'employee-1',
				isActive: true,
				isArchived: false,
				$or: [{ isManager: true }, { role: { name: RolesEnum.MANAGER } }]
			}
		});
	});
});
