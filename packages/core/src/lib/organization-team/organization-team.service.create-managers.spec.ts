import '../core/entities/internal';

import { RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { OrganizationTeamService } from './organization-team.service';

/**
 * Creating a team gave its managers the MANAGER role but left `isManager` at its default `false`, while the
 * project, sprint and module members, the seed and the join request all set it. The checks that read the flag
 * (managed employees, the tracked-data guard) then did not see the new team's managers.
 */
describe('OrganizationTeamService.create — manager flag on the members', () => {
	const managerRole = { id: 'role-manager', name: RolesEnum.MANAGER };

	let saved: Record<string, any>;
	let service: OrganizationTeamService;

	beforeEach(() => {
		saved = undefined;
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(null);
		jest.spyOn(RequestContext, 'currentRoleId').mockReturnValue('role-admin');
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

	it('flags the managers and only them', async () => {
		await service.create({
			name: 'Team',
			organizationId: 'organization-1',
			managerIds: ['manager-employee'],
			memberIds: ['member-employee']
		} as any);

		const members = saved.members.map(({ employee, isManager, role }) => ({
			employeeId: employee.id,
			isManager,
			role
		}));
		expect(members).toEqual([
			{ employeeId: 'manager-employee', isManager: true, role: managerRole },
			{ employeeId: 'member-employee', isManager: false, role: null }
		]);
	});
});
