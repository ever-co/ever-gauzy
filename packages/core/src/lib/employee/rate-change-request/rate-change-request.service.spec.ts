import '../../core/entities/internal';

import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { CurrenciesEnum, EmployeeNotificationTypeEnum, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { EmployeeCreateNotificationEvent } from '../../employee-notification/events/employee-notification.event';
import { EmployeeNotificationTypeTransformer } from '../../employee-notification/employee-notification-type-transform';
import { EmployeeRateChangeRequestService, rateChangeRequestNotice } from './rate-change-request.service';

/**
 * An employee whose organization locks their rate asks the admins for a change instead. The request reaches every
 * active employee of the organization whose role grants ORG_EMPLOYEES_EDIT, never the requester, and the requester is
 * always the caller's own employee.
 */

const TENANT = 'tenant-1';
const ORGANIZATION = 'organization-1';

interface EmployeeRow {
	id: string;
	permissions: string[];
	billRateValue?: number | null;
	billRateCurrency?: string | null;
	user?: { name: string };
}

describe('EmployeeRateChangeRequestService', () => {
	let rows: EmployeeRow[];
	let callerEmployeeId: string | null;
	let publish: jest.Mock;
	let employeeRepository: { findOne: jest.Mock; find: jest.Mock; manager: { count: jest.Mock } };
	let service: EmployeeRateChangeRequestService;

	/** Applies the receivers' conditions as the database would: the role's permission, and `id` not the requester. */
	const holdsDecidingPermission = (row: EmployeeRow, where: any) => {
		const permission = where.user.role.rolePermissions.permission;
		return row.permissions.includes(permission);
	};
	const isNotExcluded = (row: EmployeeRow, where: any) => {
		const condition = where.id;
		if (condition instanceof FindOperator) {
			return row.id !== condition.value;
		}
		return true;
	};

	beforeEach(() => {
		callerEmployeeId = 'requester';
		rows = [
			{
				id: 'requester',
				permissions: [],
				billRateValue: 25,
				billRateCurrency: CurrenciesEnum.USD,
				user: { name: 'Marie Curie' }
			},
			{ id: 'admin-1', permissions: [PermissionsEnum.ORG_EMPLOYEES_EDIT] },
			{
				id: 'admin-2',
				permissions: [PermissionsEnum.ORG_EMPLOYEES_EDIT, PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]
			},
			{ id: 'colleague', permissions: [PermissionsEnum.ORG_TEAM_EDIT] }
		];
		publish = jest.fn();
		employeeRepository = {
			findOne: jest.fn(async ({ where }: any) => rows.find((row) => row.id === where.id) ?? null),
			find: jest.fn(async ({ where }: any) =>
				rows.filter((row) => holdsDecidingPermission(row, where) && isNotExcluded(row, where))
			),
			manager: { count: jest.fn(async () => 1) }
		};
		service = new EmployeeRateChangeRequestService(employeeRepository as never, {} as never, { publish } as never);
		Object.assign(service, { ormType: 'typeorm' });

		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentUser').mockImplementation(
			() => ({ id: 'user-1', employeeId: callerEmployeeId }) as never
		);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue('user-1');
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORGANIZATION);
		jest.spyOn(RequestContext, 'hasRoles').mockReturnValue(false);
	});

	afterEach(() => jest.restoreAllMocks());

	const request = (body: Record<string, unknown> = {}) =>
		service.request({ organizationId: ORGANIZATION, billRateValue: 30, ...body } as never);

	const published = () => publish.mock.calls.map(([event]) => (event as EmployeeCreateNotificationEvent).input);

	it('notifies every admin of the organization, never the requester or a plain colleague', async () => {
		await expect(request({ reason: 'New certification' })).resolves.toEqual({ notified: 2 });

		expect(published().map((input) => input.receiverEmployeeId)).toEqual(['admin-1', 'admin-2']);
		expect(published()[0]).toMatchObject({
			type: EmployeeNotificationTypeEnum.RATE_CHANGE_REQUEST,
			entityId: 'requester',
			sentByEmployeeId: 'requester',
			organizationId: ORGANIZATION,
			tenantId: TENANT,
			title: 'Marie Curie asked for a rate change',
			message: 'Current rate: 25 USD per hour. Requested rate: 30 USD per hour. Reason: New certification'
		});
	});

	it('takes the requester from the token, whatever the body names', async () => {
		await request({ employeeId: 'admin-1' });

		expect(published().every((input) => input.sentByEmployeeId === 'requester')).toBe(true);
		expect(published().map((input) => input.receiverEmployeeId)).not.toContain('requester');
	});

	it('does not notify an admin of their own request', async () => {
		rows[0].permissions = [PermissionsEnum.ORG_EMPLOYEES_EDIT];

		await expect(request()).resolves.toEqual({ notified: 2 });
		expect(published().map((input) => input.receiverEmployeeId)).toEqual(['admin-1', 'admin-2']);
	});

	it('answers notified: 0 when the organization has no admin to notify', async () => {
		rows = rows.filter((row) => !row.permissions.includes(PermissionsEnum.ORG_EMPLOYEES_EDIT));

		await expect(request()).resolves.toEqual({ notified: 0 });
		expect(publish).not.toHaveBeenCalled();
	});

	it('refuses a body that names no organization before reading any employee, so no other organization is reached', async () => {
		await expect(request({ organizationId: undefined, sentTo: 'anything' })).rejects.toThrow(BadRequestException);

		expect(employeeRepository.findOne).not.toHaveBeenCalled();
		expect(employeeRepository.find).not.toHaveBeenCalled();
		expect(publish).not.toHaveBeenCalled();
	});

	it('refuses a caller without an employee, and an employee of another organization', async () => {
		callerEmployeeId = null;
		await expect(request()).rejects.toThrow(ForbiddenException);

		callerEmployeeId = 'stranger';
		await expect(request()).rejects.toThrow(NotFoundException);

		expect(publish).not.toHaveBeenCalled();
	});
});

describe('rateChangeRequestNotice', () => {
	it('states a missing current rate, and keeps the current currency when the request names none', () => {
		const notice = rateChangeRequestNotice(
			{ fullName: 'Ada', billRateValue: null, billRateCurrency: 'EUR' } as never,
			{
				organizationId: ORGANIZATION,
				billRateValue: 40
			}
		);

		expect(notice).toEqual({
			title: 'Ada asked for a rate change',
			message: 'Current rate: none per hour. Requested rate: 40 EUR per hour.'
		});
	});
});

describe('EmployeeNotificationTypeTransformer', () => {
	it('stores a rate change request as 7, after the existing types whose stored values do not move', () => {
		const transformer = new EmployeeNotificationTypeTransformer();

		expect(transformer.to(EmployeeNotificationTypeEnum.RATE_CHANGE_REQUEST)).toBe(7);
		expect(transformer.from(7)).toBe(EmployeeNotificationTypeEnum.RATE_CHANGE_REQUEST);
		expect(transformer.to(EmployeeNotificationTypeEnum.BROADCAST)).toBe(6);
	});
});
