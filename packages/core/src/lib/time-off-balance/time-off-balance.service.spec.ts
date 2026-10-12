import '../core/entities/internal';

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TimeOffBalanceService } from './time-off-balance.service';

const TENANT_ID = '4d3c2b1a-9f8e-4d7c-8b6a-5e4f3d2c1b0a';
const ORGANIZATION_ID = '11223344-5566-4778-899a-bbccddeeff00';
const EMPLOYEE_ID = '7c9e1d20-3b4a-4c5d-8e6f-90a1b2c3d4e5';
const SIBLING_ORGANIZATION_ID = 'aabbccdd-eeff-4011-8223-344556677889';
const USER_ID = '2f3e4d5c-6b7a-4980-a1b2-c3d4e5f60718';

/**
 * The listing reads through the raw repository, where an undefined `organizationId` is dropped from
 * the where object instead of matching nothing. Without an organization the query would span every
 * organization of the caller's tenant, so it has to fail closed.
 */
describe('TimeOffBalanceService.findAllByFilter organization scope', () => {
	let service: TimeOffBalanceService;
	let repository: { findAndCount: jest.Mock; manager: { count: jest.Mock } };

	beforeEach(() => {
		// The caller is a member of ORGANIZATION_ID only.
		repository = {
			findAndCount: jest.fn(async () => [[], 0]),
			manager: {
				count: jest.fn(async (_entity, { where }) => (where.organizationId === ORGANIZATION_ID ? 1 : 0))
			}
		};
		service = new TimeOffBalanceService(repository as any, {} as any);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(USER_ID);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(EMPLOYEE_ID);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
			(permission) => permission !== PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('refuses to list without an organization instead of spanning the tenant', async () => {
		await expect(service.findAllByFilter({} as any)).rejects.toBeInstanceOf(BadRequestException);
		// `sentTo` is what suppresses the conditional organizationId validation on the query DTO.
		await expect(service.findAllByFilter({ sentTo: 'someone@example.com' } as any)).rejects.toBeInstanceOf(
			BadRequestException
		);

		expect(repository.findAndCount).not.toHaveBeenCalled();
	});

	it('refuses an organization the caller is not a member of, even when `sentTo` skipped the DTO check', async () => {
		// A holder of CHANGE_SELECTED_EMPLOYEE is not pinned to their own balances, so without the membership
		// check they would read every balance of a sibling organization.
		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(true);

		await expect(
			service.findAllByFilter({ organizationId: SIBLING_ORGANIZATION_ID } as any)
		).rejects.toBeInstanceOf(ForbiddenException);
		await expect(
			service.findAllByFilter({ organizationId: SIBLING_ORGANIZATION_ID, sentTo: 'someone@example.com' } as any)
		).rejects.toBeInstanceOf(ForbiddenException);

		expect(repository.manager.count.mock.calls[0][1].where).toEqual({
			tenantId: TENANT_ID,
			userId: USER_ID,
			organizationId: SIBLING_ORGANIZATION_ID
		});
		expect(repository.findAndCount).not.toHaveBeenCalled();
	});

	it('refuses when there is no authenticated user to check membership for', async () => {
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(null);

		await expect(service.findAllByFilter({ organizationId: ORGANIZATION_ID } as any)).rejects.toBeInstanceOf(
			ForbiddenException
		);
		expect(repository.findAndCount).not.toHaveBeenCalled();
	});

	it('scopes the query to the tenant, the organization and the caller when one is supplied', async () => {
		await service.findAllByFilter({ organizationId: ORGANIZATION_ID } as any);

		expect(repository.findAndCount).toHaveBeenCalledTimes(1);
		expect(repository.findAndCount.mock.calls[0][0].where).toEqual({
			tenantId: TENANT_ID,
			organizationId: ORGANIZATION_ID,
			employeeId: EMPLOYEE_ID
		});
	});
});

/**
 * The write endpoints take the same `TenantOrganizationBaseDTO` body, so `sentTo` skips their
 * organization validation too. Each write has to refuse a missing or foreign organization before it
 * touches a balance, or an editor could allocate, spend or roll over leave in a sibling organization.
 */
describe('TimeOffBalanceService writes organization scope', () => {
	let service: TimeOffBalanceService;
	let manager: { count: jest.Mock; findOne: jest.Mock };
	let repository: {
		findOne: jest.Mock;
		find: jest.Mock;
		save: jest.Mock;
		createQueryBuilder: jest.Mock;
		manager: typeof manager;
	};

	const writes: Array<[string, (organizationId?: string) => Promise<unknown>]> = [
		[
			'allocate',
			(organizationId) =>
				service.allocate({
					employeeId: EMPLOYEE_ID,
					policyId: EMPLOYEE_ID,
					year: 2026,
					accrued: 10,
					organizationId,
					sentTo: 'x'
				} as any)
		],
		[
			'deduct',
			(organizationId) =>
				service.deduct({
					employeeId: EMPLOYEE_ID,
					policyId: EMPLOYEE_ID,
					year: 2026,
					days: 1,
					organizationId,
					sentTo: 'x'
				} as any)
		],
		[
			'reverse',
			(organizationId) =>
				service.reverse({
					employeeId: EMPLOYEE_ID,
					policyId: EMPLOYEE_ID,
					year: 2026,
					days: 1,
					organizationId,
					sentTo: 'x'
				} as any)
		],
		[
			'carryForward',
			(organizationId) =>
				service.carryForward({
					policyId: EMPLOYEE_ID,
					fromYear: 2025,
					toYear: 2026,
					organizationId,
					sentTo: 'x'
				} as any)
		]
	];

	beforeEach(() => {
		// The caller is a member of ORGANIZATION_ID only; every other lookup finds nothing.
		manager = {
			count: jest.fn(async (_entity, { where }) => (where.organizationId === ORGANIZATION_ID ? 1 : 0)),
			findOne: jest.fn(async () => null)
		};
		repository = {
			findOne: jest.fn(async () => null),
			find: jest.fn(async () => []),
			save: jest.fn(async (entity) => entity),
			createQueryBuilder: jest.fn(),
			manager
		};
		service = new TimeOffBalanceService(repository as any, {} as any);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(USER_ID);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it.each(writes)('%s refuses a missing organization before touching any balance', async (_name, write) => {
		await expect(write(undefined)).rejects.toBeInstanceOf(BadRequestException);

		expect(manager.count).not.toHaveBeenCalled();
		expect(manager.findOne).not.toHaveBeenCalled();
		expect(repository.createQueryBuilder).not.toHaveBeenCalled();
		expect(repository.findOne).not.toHaveBeenCalled();
		expect(repository.save).not.toHaveBeenCalled();
	});

	it.each(writes)('%s refuses an organization the caller is not a member of', async (_name, write) => {
		await expect(write(SIBLING_ORGANIZATION_ID)).rejects.toBeInstanceOf(ForbiddenException);

		expect(manager.count).toHaveBeenCalledTimes(1);
		expect(manager.count.mock.calls[0][1].where).toEqual({
			tenantId: TENANT_ID,
			userId: USER_ID,
			organizationId: SIBLING_ORGANIZATION_ID
		});
		expect(manager.findOne).not.toHaveBeenCalled();
		expect(repository.createQueryBuilder).not.toHaveBeenCalled();
		expect(repository.findOne).not.toHaveBeenCalled();
		expect(repository.save).not.toHaveBeenCalled();
	});
});
