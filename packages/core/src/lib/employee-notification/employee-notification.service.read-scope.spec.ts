import '../core/entities/internal';

import { FindOperator } from 'typeorm';
import { IUser, PermissionsEnum } from '@gauzy/contracts';
import { CrudService } from '../core/crud/crud.service';
import { asTenantUser, createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { EmployeeNotificationService } from './employee-notification.service';

/**
 * Notifications are addressed to a `receiverEmployeeId`, a column the automatic employee filter of
 * TenantAwareCrudService (which looks for `employeeId`) ignores: every read route (`GET /employee-notification`,
 * `/pagination`, `/count`, `/:id`) listed the whole tenant's notifications to any employee. Reads are now
 * limited to the caller's own notifications unless they hold CHANGE_SELECTED_EMPLOYEE.
 */
describe('EmployeeNotificationService reads are limited to the receiver', () => {
	const employee = createTenantFixture({ user: { employeeId: 'employee-me' } as IUser });
	const noEmployee = createTenantFixture({ tenantId: employee.tenantId, organizationId: employee.organizationId });

	let restore: () => void;
	let findAll: jest.SpyInstance;
	let paginate: jest.SpyInstance;
	let countBy: jest.SpyInstance;
	let findOneByIdString: jest.SpyInstance;
	let service: EmployeeNotificationService;

	// What the client asked for: somebody else's notifications
	const clientWhere = { receiverEmployeeId: 'employee-other', isRead: false };
	const whereOf = (spy: jest.SpyInstance) => spy.mock.calls[0][0]?.where ?? spy.mock.calls[0][0];

	beforeEach(() => {
		findAll = jest.spyOn(CrudService.prototype, 'findAll').mockResolvedValue({ items: [], total: 0 });
		paginate = jest.spyOn(CrudService.prototype, 'paginate').mockResolvedValue({ items: [], total: 0 });
		countBy = jest.spyOn(CrudService.prototype, 'countBy').mockResolvedValue(0);
		findOneByIdString = jest.spyOn(CrudService.prototype, 'findOneByIdString').mockResolvedValue({} as never);
		service = new EmployeeNotificationService(
			// The entity has receiverEmployeeId / sentByEmployeeId but no employeeId column
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ metadata: { tableName: 'employee_notification', hasColumnWithPropertyPath: () => false } } as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{} as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{} as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ publish: jest.fn() } as any
		);
	});

	afterEach(() => {
		restore?.();
		jest.restoreAllMocks();
	});

	it('an employee only reads their own notifications, whatever receiver the client names', async () => {
		({ restore } = asTenantUser(employee));

		await service.findAll({ where: clientWhere });
		await service.paginate({ where: clientWhere });
		await service.countBy(clientWhere);
		await service.findOneByIdString('notification-1');

		for (const spy of [findAll, paginate, countBy]) {
			expect(whereOf(spy)).toMatchObject({
				receiverEmployeeId: 'employee-me',
				isRead: false,
				tenantId: employee.tenantId
			});
		}
		expect(findOneByIdString.mock.calls[0][1].where).toMatchObject({ receiverEmployeeId: 'employee-me' });
	});

	it('applies the receiver to every clause of an OR where', async () => {
		({ restore } = asTenantUser(employee));

		await service.findAll({ where: [{ isRead: false }, { isArchived: true }] });

		const where = whereOf(findAll) as Array<Record<string, unknown>>;
		expect(where).toHaveLength(2);
		expect(where.every((clause) => clause.receiverEmployeeId === 'employee-me')).toBe(true);
	});

	it('a CHANGE_SELECTED_EMPLOYEE holder reads what the client asked for', async () => {
		({ restore } = asTenantUser(employee, { permissions: [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE] }));

		await service.findAll({ where: clientWhere });

		expect(whereOf(findAll)).toMatchObject({ receiverEmployeeId: 'employee-other' });
	});

	it('a caller without an employee record and without the permission reads nothing', async () => {
		({ restore } = asTenantUser(noEmployee));

		await service.findAll({ where: clientWhere });

		const receiver = whereOf(findAll).receiverEmployeeId as FindOperator<string>;
		expect(receiver.type).toBe('in');
		expect(receiver.value).toEqual([]);
	});
});
