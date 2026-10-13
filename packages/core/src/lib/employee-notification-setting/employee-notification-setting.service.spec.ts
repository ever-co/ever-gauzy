import '../core/entities/internal';

import { AsyncLocalStorage } from 'node:async_hooks';
import { IUser } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { asTenantUser, createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { EmployeeNotificationSettingService } from './employee-notification-setting.service';

/**
 * When a notification is created, the RECEIVER's settings decide whether they want it. The setting service
 * limits a caller without CHANGE_SELECTED_EMPLOYEE to their own employee, so a notification sent by an
 * employee or a manager used to be checked against the SENDER's settings, and a missing row was created
 * for the sender. `findByEmployee` / `createForEmployee` reach the named employee's row.
 */
describe('EmployeeNotificationSettingService for another employee', () => {
	const sender = createTenantFixture({ user: { employeeId: 'sender-employee' } as IUser });
	const receiver = {
		employeeId: 'receiver-employee',
		organizationId: sender.organizationId,
		tenantId: sender.tenantId
	};

	/** Stands in for nestjs-cls, where the employee-filter bypass is stored per request. */
	const requestStorage = new AsyncLocalStorage<Map<string, unknown>>();
	const originalClsService = RequestContext['clsService'];

	let restore: () => void;
	let findOneByWhereOptions: jest.SpyInstance;
	let create: jest.SpyInstance;
	let service: EmployeeNotificationSettingService;

	beforeEach(() => {
		RequestContext['clsService'] = {
			get: (key: string) => requestStorage.getStore()?.get(key),
			set: (key: string, value: unknown) => requestStorage.getStore()?.set(key, value)
		} as never;
		({ restore } = asTenantUser(sender));
		findOneByWhereOptions = jest
			.spyOn(CrudService.prototype, 'findOneByWhereOptions')
			.mockResolvedValue({} as never);
		create = jest.spyOn(CrudService.prototype, 'create').mockImplementation(async (entity) => entity as never);
		service = new EmployeeNotificationSettingService(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ metadata: { tableName: 'employee_notification_setting', hasColumnWithPropertyPath: () => true } } as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{} as any
		);
	});

	afterEach(() => {
		RequestContext['clsService'] = originalClsService;
		restore();
		jest.restoreAllMocks();
	});

	it("a plain read is limited to the caller's own employee (the bug the methods below avoid)", async () => {
		await requestStorage.run(new Map(), () => service.findOneByWhereOptions(receiver));

		expect(findOneByWhereOptions.mock.calls[0][0]).toMatchObject({ employeeId: 'sender-employee' });
	});

	it("findByEmployee reads the named employee's settings", async () => {
		await requestStorage.run(new Map(), () => service.findByEmployee(receiver));

		expect(findOneByWhereOptions.mock.calls[0][0]).toMatchObject({
			employeeId: 'receiver-employee',
			tenantId: sender.tenantId
		});
	});

	it("createForEmployee stores the named employee's settings", async () => {
		await requestStorage.run(new Map(), () => service.createForEmployee({ ...receiver, mention: true }));

		expect(create.mock.calls[0][0]).toMatchObject({ employeeId: 'receiver-employee', mention: true });
	});
});
