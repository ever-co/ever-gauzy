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

	it('allows a manager whose managed team contains the target employee', async () => {
		teamEmployeeRepository.find.mockResolvedValue([{ organizationTeamId: TEAM_ID }]);
		teamEmployeeRepository.existsBy.mockResolvedValue(true);

		await expect(service.canManageEmployee(TARGET_ID)).resolves.toBe(true);

		expect(teamEmployeeRepository.find).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ employeeId: ACTOR_ID, isManager: true, tenantId: TENANT_ID })
			})
		);
		expect(teamEmployeeRepository.existsBy).toHaveBeenCalledWith(
			expect.objectContaining({
				employeeId: TARGET_ID,
				organizationTeamId: In([TEAM_ID]),
				tenantId: TENANT_ID
			})
		);
	});

	it('denies when the target employee belongs to no team the caller manages', async () => {
		teamEmployeeRepository.find.mockResolvedValue([{ organizationTeamId: OTHER_TEAM_ID }]);
		teamEmployeeRepository.existsBy.mockResolvedValue(false);

		await expect(service.canManageEmployee(TARGET_ID)).resolves.toBe(false);

		expect(teamEmployeeRepository.existsBy).toHaveBeenCalledWith(
			expect.objectContaining({ organizationTeamId: In([OTHER_TEAM_ID]) })
		);
	});

	it('restricts the managed teams to the organization when the caller provides one', async () => {
		teamEmployeeRepository.find.mockResolvedValue([{ organizationTeamId: TEAM_ID }]);
		teamEmployeeRepository.existsBy.mockResolvedValue(true);

		await expect(service.canManageEmployee(TARGET_ID, undefined, ORGANIZATION_ID)).resolves.toBe(true);

		expect(teamEmployeeRepository.find).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ organizationTeam: { organizationId: ORGANIZATION_ID } })
			})
		);
	});

	it('denies without a membership query when the caller manages no team', async () => {
		teamEmployeeRepository.find.mockResolvedValue([]);

		await expect(service.canManageEmployee(TARGET_ID)).resolves.toBe(false);

		expect(teamEmployeeRepository.existsBy).not.toHaveBeenCalled();
	});

	it('keeps the self-access and global permission short circuits', async () => {
		await expect(service.canManageEmployee(ACTOR_ID)).resolves.toBe(true);

		jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
			(permission) => permission === PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		);
		await expect(service.canManageEmployee(TARGET_ID)).resolves.toBe(true);

		expect(teamEmployeeRepository.find).not.toHaveBeenCalled();
	});
});
