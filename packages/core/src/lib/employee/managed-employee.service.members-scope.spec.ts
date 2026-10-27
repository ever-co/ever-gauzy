import '../core/entities/internal';

import { Equal, In, IsNull, Or } from 'typeorm';
import { RequestContext } from '../core/context';
import { ManagedEmployeeService, NO_ACCESSIBLE_EMPLOYEE_ID } from './managed-employee.service';

const TENANT_ID = '9d347c5c-5b96-4ef3-9799-b5fa0ca09111';
const CALLER = '7f0d2585-296f-49cc-a229-210f5f11e372';
const TEAM_MATE = '12128029-8b07-45a0-9690-181a66a660fc';
const PROJECT_MATE = 'a1d1b9f4-1c55-4f5e-9a0e-3b9a2c1f7e01';
const TEAM = '66ba5d6e-a3c6-4be8-b74d-fb8aece4bd58';
const PROJECT = 'c5fc5345-c47b-4b08-b63c-f17c88679aca';

const active = () => ({ isActive: Or(IsNull(), Equal(true)), isArchived: Or(IsNull(), Equal(false)) });

/**
 * `GET /employee/members` (and the `employeeMembers` field) refused an employee who named no team, so the
 * Plane UI, which lists a workspace's members without one, showed every project with no members to the
 * 42 employees of the prod PM tenant. Naming neither now lists the people the caller shares an active team
 * or project with; a named team or project must still be the caller's.
 */
describe('ManagedEmployeeService.scopeMembersRead', () => {
	let service: ManagedEmployeeService;
	let teams: { find: jest.Mock; existsBy: jest.Mock };
	let projects: { find: jest.Mock; existsBy: jest.Mock };

	beforeEach(() => {
		teams = {
			find: jest.fn(async ({ where }) =>
				where.employeeId ? [{ organizationTeamId: TEAM }] : [{ employeeId: CALLER }, { employeeId: TEAM_MATE }]
			),
			existsBy: jest.fn(async ({ organizationTeamId }) => organizationTeamId === TEAM)
		};
		projects = {
			find: jest.fn(async ({ where }) =>
				where.employeeId
					? [{ organizationProjectId: PROJECT }]
					: [{ employeeId: CALLER }, { employeeId: PROJECT_MATE }, { employeeId: TEAM_MATE }]
			),
			existsBy: jest.fn(async ({ organizationProjectId }) => organizationProjectId === PROJECT)
		};
		service = new ManagedEmployeeService(teams as any, projects as any);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
	});

	afterEach(() => jest.restoreAllMocks());

	it('lists the people the caller shares a team or project with, once each, the caller included', async () => {
		const scope = await service.scopeMembersRead(CALLER);

		expect(scope).toEqual({ allowed: true, employeeIds: [CALLER, TEAM_MATE, PROJECT_MATE] });

		// The full predicates are asserted on purpose: dropping the tenant or the active flags would widen
		// the list, and objectContaining would not notice.
		expect(teams.find.mock.calls.map(([options]) => options)).toEqual([
			{ select: { organizationTeamId: true }, where: { employeeId: CALLER, tenantId: TENANT_ID, ...active() } },
			{
				select: { employeeId: true },
				where: { organizationTeamId: In([TEAM]), tenantId: TENANT_ID, ...active() }
			}
		]);
		expect(projects.find.mock.calls.map(([options]) => options)).toEqual([
			{
				select: { organizationProjectId: true },
				where: { employeeId: CALLER, tenantId: TENANT_ID, ...active() }
			},
			{
				select: { employeeId: true },
				where: { organizationProjectId: In([PROJECT]), tenantId: TENANT_ID, ...active() }
			}
		]);
	});

	it('lists only the caller when they belong to no team or project', async () => {
		teams.find.mockResolvedValue([]);
		projects.find.mockResolvedValue([]);

		expect(await service.scopeMembersRead(CALLER)).toEqual({ allowed: true, employeeIds: [CALLER] });
		// No membership, so no second read with an empty In() list.
		expect(teams.find).toHaveBeenCalledTimes(1);
		expect(projects.find).toHaveBeenCalledTimes(1);
	});

	it('allows a named team or project only when the caller belongs to it', async () => {
		await expect(service.scopeMembersRead(CALLER, TEAM)).resolves.toEqual({ allowed: true });
		await expect(service.scopeMembersRead(CALLER, 'another-team')).resolves.toEqual({ allowed: false });
		await expect(service.scopeMembersRead(CALLER, undefined, PROJECT)).resolves.toEqual({ allowed: true });
		await expect(service.scopeMembersRead(CALLER, undefined, 'another-project')).resolves.toEqual({
			allowed: false
		});

		expect(projects.existsBy).toHaveBeenLastCalledWith({
			employeeId: CALLER,
			organizationProjectId: 'another-project',
			tenantId: TENANT_ID,
			...active()
		});
		// A named team or project is never widened to the caller's colleagues.
		expect(teams.find).not.toHaveBeenCalled();
		expect(projects.find).not.toHaveBeenCalled();
	});

	it('checks the team, not the project, when a read names both', async () => {
		await expect(service.scopeMembersRead(CALLER, 'another-team', PROJECT)).resolves.toEqual({ allowed: false });
		expect(projects.existsBy).not.toHaveBeenCalled();
	});

	it('refuses a caller without an employee record and reads nothing', async () => {
		await expect(service.scopeMembersRead(undefined)).resolves.toEqual({ allowed: false });
		await expect(service.scopeMembersRead(undefined, TEAM)).resolves.toEqual({ allowed: false });
		expect(teams.find).not.toHaveBeenCalled();
		expect(teams.existsBy).not.toHaveBeenCalled();
	});

	it('matches no one when the tenant is unknown', async () => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(undefined);

		expect(await service.findColleagueEmployeeIds(CALLER)).toEqual([NO_ACCESSIBLE_EMPLOYEE_ID]);
		await expect(service.isMemberOfProject(CALLER, PROJECT)).resolves.toBe(false);
		expect(teams.find).not.toHaveBeenCalled();
		expect(projects.existsBy).not.toHaveBeenCalled();
	});
});
