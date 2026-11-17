import '../core/entities/internal';

import { Equal, In, IsNull, Or } from 'typeorm';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { ManagedEmployeeService } from './managed-employee.service';

const TENANT_ID = '0d1e2f3a-4b5c-4d6e-8f70-81920a1b2c41';
const ORGANIZATION_ID = '1e2f3a4b-5c6d-4e7f-8081-920a1b2c3d42';
const TEAM_ID = '2f3a4b5c-6d7e-4f80-9192-0a1b2c3d4e43';
const OTHER_TEAM_ID = '3a4b5c6d-7e8f-4091-82a3-1b2c3d4e5f44';
const PROJECT_ID = '4b5c6d7e-8f90-41a2-93b4-2c3d4e5f6a45';
const ACTOR_ID = '5c6d7e8f-9001-42b3-84c5-3d4e5f6a7b46';
const TARGET_ID = '6d7e8f90-0112-43c4-95d6-4e5f6a7b8c47';

const ACTIVE_MEMBERSHIP = { isActive: Or(IsNull(), Equal(true)), isArchived: Or(IsNull(), Equal(false)) };
const ACTIVE_GROUP_IN_ORGANIZATION = { ...ACTIVE_MEMBERSHIP, deletedAt: IsNull(), organizationId: ORGANIZATION_ID };

/**
 * Who manages an employee in an organization, for the reads that answer a record by its id (the custom-tracking
 * slot route). A team or project counts by its `isManager` flag alone, the right to act for the members that only a
 * caller who may act for every employee hands on, and only when it is in effect in that organization. The MANAGER
 * role does not count: an employee who creates a team picks its members and gets that role on it.
 */
describe('ManagedEmployeeService.managesEmployeeInOrganization', () => {
	let service: ManagedEmployeeService;
	let teamEmployeeRepository: { find: jest.Mock; existsBy: jest.Mock };
	let projectEmployeeRepository: { find: jest.Mock; existsBy: jest.Mock };

	beforeEach(() => {
		teamEmployeeRepository = { find: jest.fn(async () => []), existsBy: jest.fn(async () => false) };
		projectEmployeeRepository = { find: jest.fn(async () => []), existsBy: jest.fn(async () => false) };

		service = new ManagedEmployeeService(teamEmployeeRepository as any, projectEmployeeRepository as any);

		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ employeeId: ACTOR_ID } as any);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	const manages = () => service.managesEmployeeInOrganization(TARGET_ID, ORGANIZATION_ID);

	it("reads the caller's memberships of teams and projects in effect in the organization", async () => {
		await manages();

		// The full predicates are asserted on purpose: dropping the organization anchor or an active filter would
		// silently widen who counts as a manager, and objectContaining would not notice.
		expect(teamEmployeeRepository.find).toHaveBeenCalledWith({
			where: {
				employeeId: ACTOR_ID,
				tenantId: TENANT_ID,
				isManager: true,
				...ACTIVE_MEMBERSHIP,
				organizationTeam: ACTIVE_GROUP_IN_ORGANIZATION
			},
			select: { organizationTeamId: true }
		});
		expect(projectEmployeeRepository.find).toHaveBeenCalledWith({
			where: {
				employeeId: ACTOR_ID,
				tenantId: TENANT_ID,
				isManager: true,
				...ACTIVE_MEMBERSHIP,
				organizationProject: ACTIVE_GROUP_IN_ORGANIZATION
			},
			select: { organizationProjectId: true }
		});
	});

	it('is true for a team manager by the flag when the target is an active member of the team', async () => {
		teamEmployeeRepository.find.mockResolvedValue([{ organizationTeamId: TEAM_ID, isManager: true }]);
		teamEmployeeRepository.existsBy.mockResolvedValue(true);

		await expect(manages()).resolves.toBe(true);

		expect(teamEmployeeRepository.existsBy).toHaveBeenCalledWith({
			employeeId: TARGET_ID,
			organizationTeamId: In([TEAM_ID]),
			tenantId: TENANT_ID,
			...ACTIVE_MEMBERSHIP
		});
	});

	it('does not count the MANAGER role: the team read asks for the flag and loads no role', async () => {
		await manages();

		const [{ where, relations }] = teamEmployeeRepository.find.mock.calls[0];
		expect(where.isManager).toBe(true);
		expect(where).not.toHaveProperty('role');
		expect(relations).toBeUndefined();
	});

	it('is false, with no member lookup, when the caller manages no team or project there', async () => {
		// What the flag predicate leaves of a team the caller created themselves: they hold its MANAGER role only.
		teamEmployeeRepository.find.mockResolvedValue([]);
		projectEmployeeRepository.find.mockResolvedValue([]);

		await expect(manages()).resolves.toBe(false);

		expect(teamEmployeeRepository.existsBy).not.toHaveBeenCalled();
		expect(projectEmployeeRepository.existsBy).not.toHaveBeenCalled();
	});

	it('is false when the target belongs to none of the teams the caller manages', async () => {
		teamEmployeeRepository.find.mockResolvedValue([{ organizationTeamId: OTHER_TEAM_ID, isManager: true }]);

		await expect(manages()).resolves.toBe(false);

		expect(teamEmployeeRepository.existsBy).toHaveBeenCalledWith(
			expect.objectContaining({ employeeId: TARGET_ID, organizationTeamId: In([OTHER_TEAM_ID]) })
		);
	});

	it('is true for a project manager when the target is an active member of the project', async () => {
		projectEmployeeRepository.find.mockResolvedValue([{ organizationProjectId: PROJECT_ID }]);
		projectEmployeeRepository.existsBy.mockResolvedValue(true);

		await expect(manages()).resolves.toBe(true);

		expect(projectEmployeeRepository.existsBy).toHaveBeenCalledWith({
			employeeId: TARGET_ID,
			organizationProjectId: In([PROJECT_ID]),
			tenantId: TENANT_ID,
			...ACTIVE_MEMBERSHIP
		});
	});

	it('grants nothing by permission: CHANGE_SELECTED_EMPLOYEE is for the caller to decide', async () => {
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
			(permission) => permission === PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		);

		await expect(manages()).resolves.toBe(false);
	});

	it.each([
		[
			'the caller has no employee identity',
			() => jest.spyOn(RequestContext, 'currentUser').mockReturnValue({} as any)
		],
		['there is no tenant', () => jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(null)]
	])('fails closed without a query when %s', async (_case, arrange) => {
		arrange();

		await expect(manages()).resolves.toBe(false);

		expect(teamEmployeeRepository.find).not.toHaveBeenCalled();
		expect(projectEmployeeRepository.find).not.toHaveBeenCalled();
	});

	it('fails closed without a query when the target or the organization is missing', async () => {
		await expect(service.managesEmployeeInOrganization(undefined as any, ORGANIZATION_ID)).resolves.toBe(false);
		await expect(service.managesEmployeeInOrganization(TARGET_ID, undefined as any)).resolves.toBe(false);

		expect(teamEmployeeRepository.find).not.toHaveBeenCalled();
		expect(projectEmployeeRepository.find).not.toHaveBeenCalled();
	});
});
