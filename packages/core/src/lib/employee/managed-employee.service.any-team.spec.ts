import '../core/entities/internal';

import { In } from 'typeorm';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { ManagedEmployeeService } from './managed-employee.service';

const TENANT_ID = '9d347c5c-5b96-4ef3-9799-b5fa0ca09111';
const ORGANIZATION_ID = '3c6bdbd4-4e3f-4d8b-8a0e-8cf2c50ee2d1';
const TEAM_ID = '66ba5d6e-a3c6-4be8-b74d-fb8aece4bd58';
const OTHER_TEAM_ID = 'c5fc5345-c47b-4b08-b63c-f17c88679aca';
const ACTOR_ID = '7f0d2585-296f-49cc-a229-210f5f11e372';
const TARGET_ID = '12128029-8b07-45a0-9690-181a66a660fc';

describe('ManagedEmployeeService.canManageEmployee without a team context', () => {
	let service: ManagedEmployeeService;
	let teamEmployeeRepository: { find: jest.Mock; existsBy: jest.Mock };

	beforeEach(() => {
		teamEmployeeRepository = {
			find: jest.fn(async () => []),
			existsBy: jest.fn(async () => false)
		};

		service = new ManagedEmployeeService(teamEmployeeRepository as any, {} as any);

		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(false);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(ACTOR_ID);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ employeeId: ACTOR_ID } as any);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('allows a manager whose managed team, in the given organization, contains the target employee', async () => {
		teamEmployeeRepository.find.mockResolvedValue([{ organizationTeamId: TEAM_ID }]);
		teamEmployeeRepository.existsBy.mockResolvedValue(true);

		await expect(service.canManageEmployee(TARGET_ID, undefined, ORGANIZATION_ID)).resolves.toBe(true);

		// The full predicate is asserted on purpose: dropping isActive/isArchived or the organization
		// anchor would silently widen the fallback, and objectContaining would not notice.
		expect(teamEmployeeRepository.find).toHaveBeenCalledTimes(1);
		expect(teamEmployeeRepository.find.mock.calls[0][0].where).toEqual({
			employeeId: ACTOR_ID,
			isManager: true,
			isActive: true,
			isArchived: false,
			tenantId: TENANT_ID,
			organizationTeam: { organizationId: ORGANIZATION_ID }
		});
		expect(teamEmployeeRepository.existsBy).toHaveBeenCalledTimes(1);
		expect(teamEmployeeRepository.existsBy).toHaveBeenCalledWith({
			employeeId: TARGET_ID,
			organizationTeamId: In([TEAM_ID]),
			isActive: true,
			isArchived: false,
			tenantId: TENANT_ID
		});
	});

	it('denies when the target employee belongs to no team the caller manages', async () => {
		teamEmployeeRepository.find.mockResolvedValue([{ organizationTeamId: OTHER_TEAM_ID }]);
		teamEmployeeRepository.existsBy.mockResolvedValue(false);

		await expect(service.canManageEmployee(TARGET_ID, undefined, ORGANIZATION_ID)).resolves.toBe(false);

		expect(teamEmployeeRepository.existsBy).toHaveBeenCalledWith(
			expect.objectContaining({ organizationTeamId: In([OTHER_TEAM_ID]) })
		);
	});

	it('denies without a membership query when the caller manages no team', async () => {
		teamEmployeeRepository.find.mockResolvedValue([]);

		await expect(service.canManageEmployee(TARGET_ID, undefined, ORGANIZATION_ID)).resolves.toBe(false);

		expect(teamEmployeeRepository.existsBy).not.toHaveBeenCalled();
	});

	it('denies without any query when no organization is supplied', async () => {
		// Without an organization the fallback has no anchor: an undefined where key is dropped from
		// the query, so the check would span every organization of the tenant. It must fail closed.
		teamEmployeeRepository.find.mockResolvedValue([{ organizationTeamId: TEAM_ID }]);
		teamEmployeeRepository.existsBy.mockResolvedValue(true);

		await expect(service.canManageEmployee(TARGET_ID)).resolves.toBe(false);

		expect(teamEmployeeRepository.find).not.toHaveBeenCalled();
		expect(teamEmployeeRepository.existsBy).not.toHaveBeenCalled();
	});

	it('denies a missing target employee before querying', async () => {
		await expect(service.canManageEmployee(undefined as any, undefined, ORGANIZATION_ID)).resolves.toBe(false);
		await expect(service.canManageEmployee(undefined as any, TEAM_ID, ORGANIZATION_ID)).resolves.toBe(false);

		expect(teamEmployeeRepository.find).not.toHaveBeenCalled();
		expect(teamEmployeeRepository.existsBy).not.toHaveBeenCalled();
	});

	it('does not fall back to other teams when a team is supplied and the caller does not manage it', async () => {
		// The caller manages TEAM_ID, where the target is a member, but the record belongs to OTHER_TEAM_ID.
		teamEmployeeRepository.find.mockResolvedValue([{ organizationTeamId: TEAM_ID }]);
		teamEmployeeRepository.existsBy.mockResolvedValue(false);

		await expect(service.canManageEmployee(TARGET_ID, OTHER_TEAM_ID, ORGANIZATION_ID)).resolves.toBe(false);

		expect(teamEmployeeRepository.existsBy).toHaveBeenCalledTimes(1);
		expect(teamEmployeeRepository.existsBy).toHaveBeenCalledWith(
			expect.objectContaining({ employeeId: ACTOR_ID, organizationTeamId: OTHER_TEAM_ID, isManager: true })
		);
		expect(teamEmployeeRepository.find).not.toHaveBeenCalled();
	});

	it('checks the supplied team only when the caller manages it', async () => {
		teamEmployeeRepository.existsBy.mockResolvedValueOnce(true).mockResolvedValueOnce(true);

		await expect(service.canManageEmployee(TARGET_ID, TEAM_ID, ORGANIZATION_ID)).resolves.toBe(true);

		expect(teamEmployeeRepository.existsBy).toHaveBeenCalledTimes(2);
		expect(teamEmployeeRepository.existsBy).toHaveBeenLastCalledWith(
			expect.objectContaining({ employeeId: TARGET_ID, organizationTeamId: TEAM_ID })
		);
		expect(teamEmployeeRepository.find).not.toHaveBeenCalled();
	});

	it('keeps the self-access and global permission short circuits', async () => {
		await expect(service.canManageEmployee(ACTOR_ID)).resolves.toBe(true);

		jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
			(permission) => permission === PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		);
		await expect(service.canManageEmployee(TARGET_ID)).resolves.toBe(true);

		expect(teamEmployeeRepository.find).not.toHaveBeenCalled();
		expect(teamEmployeeRepository.existsBy).not.toHaveBeenCalled();
	});
});
