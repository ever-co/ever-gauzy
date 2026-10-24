import '../core/entities/internal';

import { ForbiddenException } from '@nestjs/common';
import { EmployeeNotificationTypeEnum, IUser, PermissionsEnum } from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { asTenantUser, createTenantFixture } from '../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { EmployeeNotificationService } from './employee-notification.service';

/**
 * `POST /employee-notification` and GraphQL `createEmployeeNotification` persisted the body's
 * `sentByEmployeeId` / `receiverEmployeeId` as given. Any member could file a notification that looked like
 * it came from any employee, into any colleague's inbox (privilege-escalation audit 2026-10-24, F7). The
 * inherited `PUT /:id` could also re-address an existing row, and the inherited delete was not limited to
 * the caller's own rows.
 */
describe('EmployeeNotificationService — notifications a caller files are filed as the caller', () => {
	const employee = createTenantFixture({ user: { employeeId: 'employee-me' } as IUser });
	const noEmployee = createTenantFixture({ tenantId: employee.tenantId, organizationId: employee.organizationId });

	let restore: () => void;
	let service: EmployeeNotificationService;
	let create: jest.SpyInstance;
	let isEmployeeOfOrganization: jest.SpyInstance;

	/** What a forger sends: a colleague as receiver, the CEO as sender, and members a body never writes. */
	const forged = () => ({
		id: 'notification-of-someone-else',
		title: 'Payment received',
		message: 'Open the link to confirm your bank details',
		type: EmployeeNotificationTypeEnum.PAYMENT,
		entity: 'Invoice',
		entityId: 'invoice-1',
		organizationId: employee.organizationId,
		sentByEmployeeId: 'employee-ceo',
		sentByEmployee: { id: 'employee-ceo' },
		receiverEmployee: { id: 'employee-colleague' },
		isRead: true
	});

	beforeEach(() => {
		service = new EmployeeNotificationService(
			{
				metadata: {
					tableName: 'employee_notification',
					hasColumnWithPropertyPath: (column: string) => column !== 'employeeId'
				}
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
			} as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{} as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{} as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ publish: jest.fn() } as any
		);
		create = jest.spyOn(service, 'create').mockImplementation(async (input) => ({ ...input }) as never);
		isEmployeeOfOrganization = jest
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			.spyOn(service as any, 'isEmployeeOfOrganization')
			.mockResolvedValue(true);
	});

	afterEach(() => {
		restore?.();
		jest.restoreAllMocks();
	});

	describe('createForCaller', () => {
		it('pins the sender to the caller and takes only the content columns from the body', async () => {
			({ restore } = asTenantUser(employee));

			await service.createForCaller({ ...forged(), receiverEmployeeId: 'employee-me' } as never);

			expect(create).toHaveBeenCalledTimes(1);
			const filed = create.mock.calls[0][0];
			expect(filed).toEqual({
				title: 'Payment received',
				message: 'Open the link to confirm your bank details',
				type: EmployeeNotificationTypeEnum.PAYMENT,
				onHoldUntil: undefined,
				entity: 'Invoice',
				entityId: 'invoice-1',
				organizationId: employee.organizationId,
				receiverEmployeeId: 'employee-me',
				sentByEmployeeId: 'employee-me'
			});
			// No upsert onto another row, and no relation object that would out-vote the pinned columns.
			expect(filed).not.toHaveProperty('id');
			expect(filed).not.toHaveProperty('sentByEmployee');
			expect(filed).not.toHaveProperty('receiverEmployee');
			expect(filed).not.toHaveProperty('isRead');
		});

		it('addresses the caller when the body names no receiver', async () => {
			({ restore } = asTenantUser(employee));

			// forged() names a sender but no receiver.
			await service.createForCaller(forged() as never);

			expect(create.mock.calls[0][0]).toMatchObject({
				receiverEmployeeId: 'employee-me',
				sentByEmployeeId: 'employee-me'
			});
		});

		it('refuses an employee addressing a colleague', async () => {
			({ restore } = asTenantUser(employee));

			await expect(
				service.createForCaller({ ...forged(), receiverEmployeeId: 'employee-colleague' } as never)
			).rejects.toBeInstanceOf(ForbiddenException);
			expect(create).not.toHaveBeenCalled();
		});

		it('refuses a caller with no employee record, who has no truthful sender to show', async () => {
			({ restore } = asTenantUser(noEmployee));

			await expect(
				service.createForCaller({ ...forged(), receiverEmployeeId: 'employee-colleague' } as never)
			).rejects.toBeInstanceOf(ForbiddenException);
			expect(create).not.toHaveBeenCalled();
		});

		it('refuses a CHANGE_SELECTED_EMPLOYEE holder with no employee record as well', async () => {
			({ restore } = asTenantUser(noEmployee, { permissions: [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE] }));

			await expect(
				service.createForCaller({ ...forged(), receiverEmployeeId: 'employee-colleague' } as never)
			).rejects.toBeInstanceOf(ForbiddenException);
			expect(create).not.toHaveBeenCalled();
		});

		it('lets a CHANGE_SELECTED_EMPLOYEE holder address an employee of the organization, under their own name', async () => {
			({ restore } = asTenantUser(employee, { permissions: [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE] }));

			await service.createForCaller({ ...forged(), receiverEmployeeId: 'employee-colleague' } as never);

			expect(isEmployeeOfOrganization).toHaveBeenCalledWith(
				'employee-colleague',
				employee.organizationId,
				employee.tenantId
			);
			// currentEmployeeId() is null for a holder, so the sender is read off the JWT user: still the caller.
			expect(create.mock.calls[0][0]).toMatchObject({
				receiverEmployeeId: 'employee-colleague',
				sentByEmployeeId: 'employee-me'
			});
		});

		it('refuses a CHANGE_SELECTED_EMPLOYEE holder addressing someone outside the organization', async () => {
			({ restore } = asTenantUser(employee, { permissions: [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE] }));
			isEmployeeOfOrganization.mockResolvedValueOnce(false);

			await expect(
				service.createForCaller({ ...forged(), receiverEmployeeId: 'employee-elsewhere' } as never)
			).rejects.toBeInstanceOf(ForbiddenException);
			expect(create).not.toHaveBeenCalled();
		});
	});

	describe('update', () => {
		it('never re-addresses a notification, whatever the patch names', async () => {
			({ restore } = asTenantUser(employee));
			const update = jest.spyOn(TenantAwareCrudService.prototype, 'update').mockResolvedValue({} as never);

			await service.update('notification-1', {
				isRead: true,
				receiverEmployeeId: 'employee-colleague',
				sentByEmployeeId: 'employee-ceo',
				receiverEmployee: { id: 'employee-colleague' },
				sentByEmployee: { id: 'employee-ceo' }
			} as never);

			expect(update).toHaveBeenCalledWith('notification-1', { isRead: true });
		});
	});

	describe('delete', () => {
		it("limits an employee's delete to their own notifications", async () => {
			({ restore } = asTenantUser(employee));
			const remove = jest
				.spyOn(TenantAwareCrudService.prototype, 'delete')
				.mockResolvedValue({ affected: 0, raw: [] });

			await service.delete('notification-of-someone-else');

			expect(remove).toHaveBeenCalledWith('notification-of-someone-else', {
				where: { receiverEmployeeId: 'employee-me' }
			});
		});

		it('removes nothing for a caller with no employee record and without the permission', async () => {
			({ restore } = asTenantUser(noEmployee));
			const remove = jest.spyOn(TenantAwareCrudService.prototype, 'delete');

			expect(await service.delete('notification-1')).toEqual({ affected: 0, raw: [] });
			expect(remove).not.toHaveBeenCalled();
		});

		it('leaves a CHANGE_SELECTED_EMPLOYEE holder unscoped, as the reads do', async () => {
			({ restore } = asTenantUser(employee, { permissions: [PermissionsEnum.CHANGE_SELECTED_EMPLOYEE] }));
			const remove = jest
				.spyOn(TenantAwareCrudService.prototype, 'delete')
				.mockResolvedValue({ affected: 1, raw: [] });

			await service.delete('notification-1');

			expect(remove).toHaveBeenCalledWith('notification-1', undefined);
		});
	});
});
