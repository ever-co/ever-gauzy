import '../core/entities/internal';

import { AsyncLocalStorage } from 'node:async_hooks';
import { ForbiddenException } from '@nestjs/common';
import { In } from 'typeorm';
import { IUser, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { asTenantUser, createTenantFixture, ITenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { EmployeeNotificationSettingService } from './employee-notification-setting.service';

/**
 * Notification settings are their employee's. The CRUD base limits a caller without CHANGE_SELECTED_EMPLOYEE to their
 * own employee, but a caller with no employee record at all (a viewer, a candidate) kept the tenant-wide scope: they
 * read, changed and deleted every employee's settings, and created a row for whichever employee the body named.
 */
describe('EmployeeNotificationSettingService — a caller with no employee record owns no settings', () => {
	const VICTIM = 'victim-employee';

	/** Stands in for nestjs-cls, where the employee-filter bypass is stored per request. */
	const requestStorage = new AsyncLocalStorage<Map<string, unknown>>();
	const originalClsService = RequestContext['clsService'];

	let restore: () => void;
	let findOneByWhereOptions: jest.SpyInstance;
	let deleteRows: jest.SpyInstance;
	let create: jest.SpyInstance;
	let service: EmployeeNotificationSettingService;

	const actAs = (fixture: ITenantFixture, permissions: PermissionsEnum[] = []) => {
		({ restore } = asTenantUser(fixture, { permissions }));
		return fixture;
	};
	const inRequest = <R>(work: () => Promise<R>): Promise<R> => requestStorage.run(new Map(), work);

	beforeEach(() => {
		RequestContext['clsService'] = {
			get: (key: string) => requestStorage.getStore()?.get(key),
			set: (key: string, value: unknown) => requestStorage.getStore()?.set(key, value)
		} as never;
		findOneByWhereOptions = jest
			.spyOn(CrudService.prototype, 'findOneByWhereOptions')
			.mockResolvedValue({} as never);
		deleteRows = jest.spyOn(CrudService.prototype, 'delete').mockResolvedValue({ raw: [], affected: 0 } as never);
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
		restore?.();
		jest.restoreAllMocks();
	});

	describe('a viewer: no employee record, no CHANGE_SELECTED_EMPLOYEE', () => {
		beforeEach(() => actAs(createTenantFixture()));

		it('reads no row: the read is narrowed to an employee set that is empty', async () => {
			await inRequest(() => service.findOneByWhereOptions({ employeeId: VICTIM }));

			expect(findOneByWhereOptions.mock.calls[0][0]).toMatchObject({ employeeId: In([]) });
		});

		it('deletes no row', async () => {
			await inRequest(() => service.delete('setting-of-the-victim'));

			expect(deleteRows.mock.calls[0][0]).toMatchObject({ id: 'setting-of-the-victim', employeeId: In([]) });
		});

		it('may not create a setting, for anyone', async () => {
			await expect(inRequest(() => service.create({ employeeId: VICTIM, mention: false } as never))).rejects.toBeInstanceOf(
				ForbiddenException
			);
			expect(create).not.toHaveBeenCalled();
		});

		it("CONTROL: a notification still creates its receiver's settings when this caller sends it", async () => {
			await inRequest(() => service.createForEmployee({ employeeId: VICTIM, mention: true } as never));

			expect(create.mock.calls[0][0]).toMatchObject({ employeeId: VICTIM, mention: true });
		});
	});

	describe('CONTROL: the callers the rule does not touch', () => {
		it('an employee reads and creates their own settings, whatever the body names', async () => {
			actAs(createTenantFixture({ user: { employeeId: 'own-employee' } as IUser }));

			await inRequest(() => service.findOneByWhereOptions({ employeeId: VICTIM }));
			await inRequest(() => service.create({ employeeId: VICTIM, mention: false } as never));

			expect(findOneByWhereOptions.mock.calls[0][0]).toMatchObject({ employeeId: 'own-employee' });
			expect(create.mock.calls[0][0]).toMatchObject({ employeeId: 'own-employee' });
		});

		it('a caller who may act for other employees reaches the employee they name', async () => {
			actAs(createTenantFixture(), [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE]);

			await inRequest(() => service.findOneByWhereOptions({ employeeId: VICTIM }));
			await inRequest(() => service.create({ employeeId: VICTIM, mention: false } as never));

			expect(findOneByWhereOptions.mock.calls[0][0]).toMatchObject({ employeeId: VICTIM });
			expect(create.mock.calls[0][0]).toMatchObject({ employeeId: VICTIM });
		});
	});
});
