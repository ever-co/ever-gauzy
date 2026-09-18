import { ExecutionContext, ForbiddenException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RequestContext } from '../../core/context';
import { PermissionsEnum } from '@gauzy/contracts';
import { ManagedEmployeeService } from '../../employee/managed-employee.service';
import { EmployeeTrackedDataGuard } from './employee-tracked-data.guard';

describe('EmployeeTrackedDataGuard', () => {
	let guard: EmployeeTrackedDataGuard;
	let mockDataSource: jest.Mocked<DataSource>;
	let managedEmployeeService: ManagedEmployeeService;
	let mockOrganizationRepo: { findOne: jest.Mock };
	let mockTeamEmployeeRepo: { existsBy: jest.Mock; find: jest.Mock };
	let mockProjectEmployeeRepo: { existsBy: jest.Mock; find: jest.Mock };

	const validOrgId = '11111111-1111-1111-1111-111111111111';
	const validTeamId1 = '22222222-2222-2222-2222-222222222222';
	const validTeamId2 = '33333333-3333-3333-3333-333333333333';

	beforeEach(() => {
		mockOrganizationRepo = { findOne: jest.fn() };
		mockTeamEmployeeRepo = { existsBy: jest.fn().mockResolvedValue(false), find: jest.fn().mockResolvedValue([]) };
		mockProjectEmployeeRepo = { existsBy: jest.fn().mockResolvedValue(false), find: jest.fn().mockResolvedValue([]) };

		mockDataSource = {
			getRepository: jest.fn((entityName) => {
				if (entityName === 'Organization') return mockOrganizationRepo;
				if (entityName === 'OrganizationTeamEmployee') return mockTeamEmployeeRepo;
				if (entityName === 'OrganizationProjectEmployee') return mockProjectEmployeeRepo;
				return {};
			})
		} as unknown as jest.Mocked<DataSource>;

		// Build real ManagedEmployeeService with mocked repositories
		managedEmployeeService = new ManagedEmployeeService(
			mockTeamEmployeeRepo as any,
			mockProjectEmployeeRepo as any
		);

		guard = new EmployeeTrackedDataGuard(mockDataSource, managedEmployeeService);

		// Reset RequestContext mocks
		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(false);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(null);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ employeeId: 'emp-1' } as any);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	function createMockContext(
		options: { organizationId?: string; query?: any; body?: any; params?: any } = {}
	): ExecutionContext {
		const query = options.query ?? (options.organizationId ? { organizationId: options.organizationId } : {});
		return {
			switchToHttp: () => ({
				getRequest: () => ({
					method: 'GET',
					query,
					body: options.body,
					params: options.params ?? {}
				})
			})
		} as unknown as ExecutionContext;
	}

	it('should allow if user has CHANGE_SELECTED_EMPLOYEE permission', async () => {
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((perm) => perm === PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);
		const context = createMockContext({ organizationId: validOrgId });

		const result = await guard.canActivate(context);

		expect(result).toBe(true);
		expect(mockDataSource.getRepository).not.toHaveBeenCalled();
	});

	it('should throw ForbiddenException if no organizationId can be resolved', async () => {
		const context = createMockContext({});

		await expect(guard.canActivate(context)).rejects.toThrow(
			new ForbiddenException('Organization context is required to access tracked data')
		);
	});

	it('should throw BadRequestException if organizationId is not a valid UUID', async () => {
		const context = createMockContext({ organizationId: 'abc-not-a-uuid' });

		await expect(guard.canActivate(context)).rejects.toThrow(
			new BadRequestException('Invalid organizationId')
		);
	});

	it('should throw ForbiddenException if organization is not found', async () => {
		mockOrganizationRepo.findOne.mockResolvedValue(null);
		const context = createMockContext({ organizationId: validOrgId });

		await expect(guard.canActivate(context)).rejects.toThrow(
			new ForbiddenException('Organization not found or not accessible')
		);
		expect(mockOrganizationRepo.findOne).toHaveBeenCalledWith({
			where: { id: validOrgId, tenantId: 'tenant-1' },
			select: { id: true, allowEmployeeToSeeTrackedData: true }
		});
	});

	it('should allow if allowEmployeeToSeeTrackedData is true', async () => {
		mockOrganizationRepo.findOne.mockResolvedValue({
			id: validOrgId,
			allowEmployeeToSeeTrackedData: true
		});
		const context = createMockContext({ organizationId: validOrgId });

		const result = await guard.canActivate(context);

		expect(result).toBe(true);
	});

	it('should allow if allowEmployeeToSeeTrackedData is missing (default true behavior)', async () => {
		mockOrganizationRepo.findOne.mockResolvedValue({
			id: validOrgId
		});
		const context = createMockContext({ organizationId: validOrgId });

		const result = await guard.canActivate(context);

		expect(result).toBe(true);
	});

	it('should resolve organization from RequestContext.currentOrganizationId() if not in query/body/params', async () => {
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(validOrgId);
		mockOrganizationRepo.findOne.mockResolvedValue({
			id: validOrgId,
			allowEmployeeToSeeTrackedData: true
		});
		const context = createMockContext({});

		const result = await guard.canActivate(context);

		expect(result).toBe(true);
		expect(mockOrganizationRepo.findOne).toHaveBeenCalledWith({
			where: { id: validOrgId, tenantId: 'tenant-1' },
			select: { id: true, allowEmployeeToSeeTrackedData: true }
		});
	});

	it('should allow callers with no employee record when setting is false', async () => {
		mockOrganizationRepo.findOne.mockResolvedValue({
			id: validOrgId,
			allowEmployeeToSeeTrackedData: false
		});
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ employeeId: undefined } as any);
		const context = createMockContext({ organizationId: validOrgId });

		const result = await guard.canActivate(context);

		expect(result).toBe(true);
	});

	it('should handle request with body undefined cleanly', async () => {
		mockOrganizationRepo.findOne.mockResolvedValue({
			id: validOrgId,
			allowEmployeeToSeeTrackedData: true
		});
		const context = createMockContext({ organizationId: validOrgId, body: undefined });

		const result = await guard.canActivate(context);

		expect(result).toBe(true);
	});

	it('should allow a manager of the requested team when setting is false', async () => {
		mockOrganizationRepo.findOne.mockResolvedValue({
			id: validOrgId,
			allowEmployeeToSeeTrackedData: false
		});
		// mock team repo to answer isManager = true for team 1
		mockTeamEmployeeRepo.existsBy.mockImplementation(async (query) => {
			if (query.employeeId === 'emp-1' && (query.organizationTeamId?.value === validTeamId1 || query.organizationTeamId === validTeamId1)) {
				return true;
			}
			return false;
		});

		const context = createMockContext({
			query: { organizationId: validOrgId, teamIds: [validTeamId1] }
		});

		const result = await guard.canActivate(context);

		expect(result).toBe(true);
	});

	it('should deny a manager of a different team when setting is false', async () => {
		mockOrganizationRepo.findOne.mockResolvedValue({
			id: validOrgId,
			allowEmployeeToSeeTrackedData: false
		});
		// emp-1 is manager of team 1, but request asks for team 2
		mockTeamEmployeeRepo.existsBy.mockImplementation(async (query) => {
			if (query.employeeId === 'emp-1' && (query.organizationTeamId?.value === validTeamId1 || query.organizationTeamId === validTeamId1)) {
				return true;
			}
			return false;
		});

		const context = createMockContext({
			query: { organizationId: validOrgId, teamIds: [validTeamId2] }
		});

		await expect(guard.canActivate(context)).rejects.toThrow(
			new ForbiddenException('Employees are not allowed to view tracked data in this organization')
		);
	});

	it('should allow a manager of any active team in the organization when no team/project parameters are specified', async () => {
		mockOrganizationRepo.findOne.mockResolvedValue({
			id: validOrgId,
			allowEmployeeToSeeTrackedData: false
		});
		mockTeamEmployeeRepo.existsBy.mockImplementation(async (query) => {
			if (query.employeeId === 'emp-1' && query.organizationId === validOrgId && query.isManager === true) {
				return true;
			}
			return false;
		});

		const context = createMockContext({ organizationId: validOrgId });

		const result = await guard.canActivate(context);

		expect(result).toBe(true);
	});

	it('should throw ForbiddenException for a regular employee (not manager) when setting is false', async () => {
		mockOrganizationRepo.findOne.mockResolvedValue({
			id: validOrgId,
			allowEmployeeToSeeTrackedData: false
		});
		mockTeamEmployeeRepo.existsBy.mockResolvedValue(false);
		mockProjectEmployeeRepo.existsBy.mockResolvedValue(false);

		const context = createMockContext({ organizationId: validOrgId });

		await expect(guard.canActivate(context)).rejects.toThrow(
			new ForbiddenException('Employees are not allowed to view tracked data in this organization')
		);
	});
});
