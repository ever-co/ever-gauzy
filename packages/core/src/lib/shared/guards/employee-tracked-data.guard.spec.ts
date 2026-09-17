import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RequestContext } from '../../core/context';
import { PermissionsEnum } from '@gauzy/contracts';
import { ManagedEmployeeService } from '../../employee/managed-employee.service';
import { EmployeeTrackedDataGuard } from './employee-tracked-data.guard';

describe('EmployeeTrackedDataGuard', () => {
	let guard: EmployeeTrackedDataGuard;
	let mockDataSource: jest.Mocked<DataSource>;
	let mockManagedEmployeeService: jest.Mocked<ManagedEmployeeService>;
	let mockOrganizationRepo: { findOne: jest.Mock };

	beforeEach(() => {
		mockOrganizationRepo = { findOne: jest.fn() };
		mockDataSource = {
			getRepository: jest.fn().mockReturnValue(mockOrganizationRepo)
		} as unknown as jest.Mocked<DataSource>;

		mockManagedEmployeeService = {
			isManagerOfTeamsOrProjects: jest.fn()
		} as unknown as jest.Mocked<ManagedEmployeeService>;

		guard = new EmployeeTrackedDataGuard(mockDataSource, mockManagedEmployeeService);

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
		organizationId?: string,
		method = 'GET'
	): ExecutionContext {
		return {
			switchToHttp: () => ({
				getRequest: () => ({
					method,
					query: organizationId ? { organizationId } : {},
					body: {},
					params: {}
				})
			})
		} as unknown as ExecutionContext;
	}

	it('should allow if user has CHANGE_SELECTED_EMPLOYEE permission', async () => {
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((perm) => perm === PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);
		const context = createMockContext('org-1');

		const result = await guard.canActivate(context);

		expect(result).toBe(true);
		expect(mockDataSource.getRepository).not.toHaveBeenCalled();
	});

	it('should throw ForbiddenException if no organizationId can be resolved', async () => {
		const context = createMockContext(undefined); // No org in query/body/params

		await expect(guard.canActivate(context)).rejects.toThrow(
			new ForbiddenException('Organization context is required to access tracked data')
		);
	});

	it('should throw ForbiddenException if organization is not found', async () => {
		mockOrganizationRepo.findOne.mockResolvedValue(null);
		const context = createMockContext('org-1');

		await expect(guard.canActivate(context)).rejects.toThrow(
			new ForbiddenException('Organization not found or not accessible')
		);
		expect(mockOrganizationRepo.findOne).toHaveBeenCalledWith({
			where: { id: 'org-1', tenantId: 'tenant-1' },
			select: { id: true, allowEmployeeToSeeTrackedData: true }
		});
	});

	it('should allow if allowEmployeeToSeeTrackedData is true', async () => {
		mockOrganizationRepo.findOne.mockResolvedValue({
			id: 'org-1',
			allowEmployeeToSeeTrackedData: true
		});
		const context = createMockContext('org-1');

		const result = await guard.canActivate(context);

		expect(result).toBe(true);
		expect(mockManagedEmployeeService.isManagerOfTeamsOrProjects).not.toHaveBeenCalled();
	});

	it('should allow if allowEmployeeToSeeTrackedData is missing (default true behavior)', async () => {
		mockOrganizationRepo.findOne.mockResolvedValue({
			id: 'org-1'
			// allowEmployeeToSeeTrackedData is undefined
		});
		const context = createMockContext('org-1');

		const result = await guard.canActivate(context);

		expect(result).toBe(true);
	});

	it('should allow team manager if allowEmployeeToSeeTrackedData is false', async () => {
		mockOrganizationRepo.findOne.mockResolvedValue({
			id: 'org-1',
			allowEmployeeToSeeTrackedData: false
		});
		mockManagedEmployeeService.isManagerOfTeamsOrProjects.mockResolvedValue(true);
		const context = createMockContext('org-1');

		const result = await guard.canActivate(context);

		expect(result).toBe(true);
		expect(mockManagedEmployeeService.isManagerOfTeamsOrProjects).toHaveBeenCalledWith('emp-1', [], []);
	});

	it('should throw ForbiddenException for regular employee if allowEmployeeToSeeTrackedData is false', async () => {
		mockOrganizationRepo.findOne.mockResolvedValue({
			id: 'org-1',
			allowEmployeeToSeeTrackedData: false
		});
		mockManagedEmployeeService.isManagerOfTeamsOrProjects.mockResolvedValue(false);
		const context = createMockContext('org-1');

		await expect(guard.canActivate(context)).rejects.toThrow(
			new ForbiddenException('Employees are not allowed to view tracked data in this organization')
		);
	});
});
