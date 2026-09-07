import '../../core/entities/internal';

import { ForbiddenException } from '@nestjs/common';
import { ID, IGetProfileActivity } from '@gauzy/contracts';
import { IsNull } from 'typeorm';
import { RequestContext } from '../../core/context';
import { StatisticService } from './statistic.service';

const TENANT_ID = '9d347c5c-5b96-4ef3-9799-b5fa0ca09111';
const ORGANIZATION_ID = '619ec3c7-498d-4c28-8b74-48da57cc5564';
const TEAM_ID = '66ba5d6e-a3c6-4be8-b74d-fb8aece4bd58';
const TARGET_ID = '12128029-8b07-45a0-9690-181a66a660fc';

const request: Pick<IGetProfileActivity, 'employeeId' | 'organizationId' | 'organizationTeamId'> = {
	employeeId: TARGET_ID,
	organizationId: ORGANIZATION_ID,
	organizationTeamId: TEAM_ID
};

class TestStatisticService extends StatisticService {
	authorizeProfileActivity(
		input: Pick<IGetProfileActivity, 'employeeId' | 'organizationId' | 'organizationTeamId'>
	): Promise<ID> {
		return this.assertProfileActivityAccess(input);
	}
}

describe('StatisticService profile activity access', () => {
	let service: TestStatisticService;
	let employeeRepository: { existsBy: jest.Mock };
	let managedEmployeeService: { canViewEmployeeProfile: jest.Mock };
	let typeOrmTimeLogRepository: { createQueryBuilder: jest.Mock };
	let mikroOrmTimeLogRepository: { getKnex: jest.Mock };
	let currentTenantId: jest.SpyInstance;

	beforeEach(() => {
		employeeRepository = { existsBy: jest.fn().mockResolvedValue(true) };
		managedEmployeeService = { canViewEmployeeProfile: jest.fn().mockResolvedValue(true) };
		typeOrmTimeLogRepository = { createQueryBuilder: jest.fn() };
		mikroOrmTimeLogRepository = { getKnex: jest.fn() };
		currentTenantId = jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);

		service = new TestStatisticService(
			{ createQueryBuilder: jest.fn() } as any,
			employeeRepository as any,
			{ createQueryBuilder: jest.fn() } as any,
			typeOrmTimeLogRepository as any,
			mikroOrmTimeLogRepository as any,
			{} as any,
			{} as any,
			managedEmployeeService as any
		);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	function expectNoTimeLogReads() {
		expect(typeOrmTimeLogRepository.createQueryBuilder).not.toHaveBeenCalled();
		expect(mikroOrmTimeLogRepository.getKnex).not.toHaveBeenCalled();
	}

	it('rejects a missing context tenant before any repository or policy call', async () => {
		currentTenantId.mockReturnValue(null);

		await expect(service.authorizeProfileActivity(request)).rejects.toBeInstanceOf(ForbiddenException);

		expect(employeeRepository.existsBy).not.toHaveBeenCalled();
		expect(managedEmployeeService.canViewEmployeeProfile).not.toHaveBeenCalled();
		expectNoTimeLogReads();
	});

	it('prechecks the exact active target scope before exactly one policy call and returns the context tenant', async () => {
		await expect(service.authorizeProfileActivity(request)).resolves.toBe(TENANT_ID);

		expect(employeeRepository.existsBy).toHaveBeenCalledTimes(1);
		expect(employeeRepository.existsBy).toHaveBeenCalledWith({
			id: TARGET_ID,
			tenantId: TENANT_ID,
			organizationId: ORGANIZATION_ID,
			isActive: true,
			isArchived: false,
			deletedAt: IsNull()
		});
		expect(managedEmployeeService.canViewEmployeeProfile).toHaveBeenCalledTimes(1);
		expect(managedEmployeeService.canViewEmployeeProfile).toHaveBeenCalledWith(TARGET_ID, ORGANIZATION_ID, TEAM_ID);
		expect(employeeRepository.existsBy.mock.invocationCallOrder[0]).toBeLessThan(
			managedEmployeeService.canViewEmployeeProfile.mock.invocationCallOrder[0]
		);
		expectNoTimeLogReads();
	});

	it('denies a target that fails the exact active-scope existence check without calling policy', async () => {
		employeeRepository.existsBy.mockResolvedValue(false);

		await expect(service.authorizeProfileActivity(request)).rejects.toBeInstanceOf(ForbiddenException);

		expect(employeeRepository.existsBy).toHaveBeenCalledTimes(1);
		expect(managedEmployeeService.canViewEmployeeProfile).not.toHaveBeenCalled();
		expectNoTimeLogReads();
	});

	it('turns a false policy result into the same generic forbidden response without reading time logs', async () => {
		managedEmployeeService.canViewEmployeeProfile.mockResolvedValue(false);

		let deniedByTarget: ForbiddenException;
		let deniedByPolicy: ForbiddenException;
		employeeRepository.existsBy.mockResolvedValueOnce(false);
		try {
			await service.authorizeProfileActivity(request);
		} catch (error) {
			deniedByTarget = error as ForbiddenException;
		}

		employeeRepository.existsBy.mockResolvedValueOnce(true);
		try {
			await service.authorizeProfileActivity(request);
		} catch (error) {
			deniedByPolicy = error as ForbiddenException;
		}

		expect(deniedByTarget).toBeInstanceOf(ForbiddenException);
		expect(deniedByPolicy).toBeInstanceOf(ForbiddenException);
		expect(deniedByPolicy.getResponse()).toEqual(deniedByTarget.getResponse());
		expect(JSON.stringify(deniedByPolicy.getResponse())).not.toContain(TARGET_ID);
		expect(managedEmployeeService.canViewEmployeeProfile).toHaveBeenCalledTimes(1);
		expectNoTimeLogReads();
	});

	it('propagates target repository errors unchanged without evaluating policy or reading time logs', async () => {
		const failure = new Error('employee database unavailable');
		employeeRepository.existsBy.mockRejectedValue(failure);

		await expect(service.authorizeProfileActivity(request)).rejects.toBe(failure);

		expect(managedEmployeeService.canViewEmployeeProfile).not.toHaveBeenCalled();
		expectNoTimeLogReads();
	});

	it('propagates profile policy query errors unchanged without reading time logs', async () => {
		const failure = new Error('membership database unavailable');
		managedEmployeeService.canViewEmployeeProfile.mockRejectedValue(failure);

		await expect(service.authorizeProfileActivity(request)).rejects.toBe(failure);

		expect(employeeRepository.existsBy).toHaveBeenCalledTimes(1);
		expect(managedEmployeeService.canViewEmployeeProfile).toHaveBeenCalledTimes(1);
		expectNoTimeLogReads();
	});
});
