import '../core/entities/internal';

import { PermissionsEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { OrganizationTeamService } from './organization-team.service';

/**
 * Creating a team gave its managers the MANAGER role but left `isManager` at its default `false`, while the
 * project, sprint and module members, the seed and the join request all set it. The checks that read the flag
 * (managed employees, the tracked-data guard) then did not see the new team's managers.
 *
 * The flag lets a manager act for the team's members (their daily plans and time logs), so it is set only when the
 * caller may already act for every employee (`CHANGE_SELECTED_EMPLOYEE`). An employee who creates a team picks its
 * members and is made its manager; they keep the MANAGER role without the flag, as before.
 */
describe('OrganizationTeamService.create — manager flag on the members', () => {
	const managerRole = { id: 'role-manager', name: RolesEnum.MANAGER };

	let saved: Record<string, any>;
	let permissions: PermissionsEnum[];
	let service: OrganizationTeamService;

	beforeEach(() => {
		saved = undefined;
		permissions = [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE];
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(null);
		jest.spyOn(RequestContext, 'currentRoleId').mockReturnValue('role-admin');
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission) =>
			permissions.includes(permission)
		);
		jest.spyOn(TenantAwareCrudService.prototype, 'create').mockImplementation(async (entity) => {
			saved = entity;
			return { id: 'team-1', ...entity } as never;
		});

		service = Object.create(OrganizationTeamService.prototype);
		Object.assign(service, {
			roleService: {
				// The caller is not an EMPLOYEE, so it is not added as a manager
				findOneByIdString: jest.fn().mockRejectedValue(new Error('not found')),
				findOneByWhereOptions: jest.fn().mockResolvedValue(managerRole)
			},
			retrieveEmployees: jest.fn().mockResolvedValue([{ id: 'manager-employee' }, { id: 'member-employee' }]),
			_eventBus: { publish: jest.fn() }
		});
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	/** The members the create saved, as employee, flag and role. */
	const savedMembers = () =>
		saved.members.map(({ employee, isManager, role }) => ({
			employeeId: employee.id,
			isManager,
			role
		}));

	it('flags the managers and only them', async () => {
		await service.create({
			name: 'Team',
			organizationId: 'organization-1',
			managerIds: ['manager-employee'],
			memberIds: ['member-employee']
		} as any);

		expect(savedMembers()).toEqual([
			{ employeeId: 'manager-employee', isManager: true, role: managerRole },
			{ employeeId: 'member-employee', isManager: false, role: null }
		]);
	});

	it('does not flag the managers of a team an employee creates, who keep the MANAGER role', async () => {
		// An EMPLOYEE caller: made a manager of the team they create, and free to name its members
		permissions = [PermissionsEnum.ORG_TEAM_ADD, PermissionsEnum.ORG_TEAM_EDIT];
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue('manager-employee');
		jest.spyOn(RequestContext, 'currentRoleId').mockReturnValue('role-employee');
		(service as any).roleService.findOneByIdString.mockResolvedValue({
			id: 'role-employee',
			name: RolesEnum.EMPLOYEE
		});

		await service.create({
			name: 'Team',
			organizationId: 'organization-1',
			memberIds: ['member-employee']
		} as any);

		expect(savedMembers()).toEqual([
			{ employeeId: 'manager-employee', isManager: false, role: managerRole },
			{ employeeId: 'member-employee', isManager: false, role: null }
		]);
	});
});
