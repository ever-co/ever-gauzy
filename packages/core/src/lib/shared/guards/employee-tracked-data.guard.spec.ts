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

		managedEmployeeService = new ManagedEmployeeService(
			mockTeamEmployeeRepo as any,
			mockProjectEmployeeRepo as any
		);

		guard = new EmployeeTrackedDataGuard(mockDataSource, managedEmployeeService);

		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(false);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(null);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ employeeId: 'emp-1' } as any);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	function createMockCtx(
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

	function mockOrgResponse(allowEmployeeToSeeTrackedData?: boolean): void {
		mockOrganizationRepo.findOne.mockResolvedValue({
			id: validOrgId,
			...(allowEmployeeToSeeTrackedData !== undefined ? { allowEmployeeToSeeTrackedData } : {})
		});
	}

	it('should allow if user has CHANGE_SELECTED_EMPLOYEE permission', async () => {
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((p) => p === PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);
		expect(await guard.canActivate(createMockCtx({ organizationId: validOrgId }))).toBe(true);
		expect(mockDataSource.getRepository).not.toHaveBeenCalled();
	});

	it('should throw ForbiddenException if no organizationId can be resolved', async () => {
		await expect(guard.canActivate(createMockCtx({}))).rejects.toThrow(
			new ForbiddenException('Organization context is required to access tracked data')
		);
	});

	it('should throw BadRequestException if organizationId is not a valid UUID', async () => {
		await expect(guard.canActivate(createMockCtx({ organizationId: 'invalid-uuid-string' }))).rejects.toThrow(
			new BadRequestException('Invalid organizationId')
		);
	});

	it('should throw ForbiddenException if organization is not found', async () => {
		mockOrganizationRepo.findOne.mockResolvedValue(null);
		await expect(guard.canActivate(createMockCtx({ organizationId: validOrgId }))).rejects.toThrow(
			new ForbiddenException('Organization not found or not accessible')
		);
		expect(mockOrganizationRepo.findOne).toHaveBeenCalledWith({
			where: { id: validOrgId, tenantId: 'tenant-1' },
			select: { id: true, allowEmployeeToSeeTrackedData: true }
		});
	});

	it('should allow if allowEmployeeToSeeTrackedData is true or missing', async () => {
		mockOrgResponse(true);
		expect(await guard.canActivate(createMockCtx({ organizationId: validOrgId }))).toBe(true);

		mockOrgResponse(undefined);
		expect(await guard.canActivate(createMockCtx({ organizationId: validOrgId }))).toBe(true);
	});

	it('should resolve organization from RequestContext.currentOrganizationId() if not provided', async () => {
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(validOrgId);
		mockOrgResponse(true);

		expect(await guard.canActivate(createMockCtx({}))).toBe(true);
		expect(mockOrganizationRepo.findOne).toHaveBeenCalledWith({
			where: { id: validOrgId, tenantId: 'tenant-1' },
			select: { id: true, allowEmployeeToSeeTrackedData: true }
		});
	});

	it('should allow callers with no employee record when setting is false', async () => {
		mockOrgResponse(false);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ employeeId: undefined } as any);
		expect(await guard.canActivate(createMockCtx({ organizationId: validOrgId }))).toBe(true);
	});

	it('should handle request with body undefined cleanly', async () => {
		mockOrgResponse(true);
		expect(await guard.canActivate(createMockCtx({ organizationId: validOrgId, body: undefined }))).toBe(true);
	});

	describe('Team Manager checks when allowEmployeeToSeeTrackedData is false', () => {
		beforeEach(() => {
			mockOrgResponse(false);
		});

		it('should allow a manager of the requested team', async () => {
			mockTeamEmployeeRepo.existsBy.mockImplementation(async (q) => {
				return q.employeeId === 'emp-1' && (q.organizationTeamId?.value === validTeamId1 || q.organizationTeamId === validTeamId1);
			});

			const ctx = createMockCtx({ query: { organizationId: validOrgId, teamIds: [validTeamId1] } });
			expect(await guard.canActivate(ctx)).toBe(true);
		});

		it('should deny a manager requesting a different team', async () => {
			mockTeamEmployeeRepo.existsBy.mockImplementation(async (q) => {
				return q.employeeId === 'emp-1' && (q.organizationTeamId?.value === validTeamId1 || q.organizationTeamId === validTeamId1);
			});

			const ctx = createMockCtx({ query: { organizationId: validOrgId, teamIds: [validTeamId2] } });
			await expect(guard.canActivate(ctx)).rejects.toThrow(
				new ForbiddenException('Employees are not allowed to view tracked data in this organization')
			);
		});

		it('should allow a manager of any active team in org when no scope params are specified', async () => {
			mockTeamEmployeeRepo.existsBy.mockImplementation(async (q) => {
				return q.employeeId === 'emp-1' && q.organizationId === validOrgId && q.isManager === true;
			});

			expect(await guard.canActivate(createMockCtx({ organizationId: validOrgId }))).toBe(true);
		});

		it('should deny a regular non-manager employee', async () => {
			mockTeamEmployeeRepo.existsBy.mockResolvedValue(false);
			mockProjectEmployeeRepo.existsBy.mockResolvedValue(false);

			await expect(guard.canActivate(createMockCtx({ organizationId: validOrgId }))).rejects.toThrow(
				new ForbiddenException('Employees are not allowed to view tracked data in this organization')
			);
		});
	});
});
