import '../core/entities/internal';

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EmployeeNotificationTypeEnum, IEmployeeNotificationSetting } from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { EmployeeNotificationCreatedEvent } from './events/employee-notification-created.event';
import { EmployeeNotificationService } from './employee-notification.service';

/**
 * In-app is always on (Inbox spec FR-10 / T17, owner decision 2026-11-10): a notification is saved, and so reaches
 * the bell and the Inbox, whatever the receiver's legacy per-type switches say. Those switches decide only e-mail and
 * push (the Inbox delivery rules' `kindSwitchOf`). Before, a receiver who had switched "comments" off got no row at
 * all, so no bell item and no Inbox entry.
 */
describe('EmployeeNotificationService.create — in-app is always on', () => {
	const RECEIVER = 'employee-receiver';
	const ALL_OFF: IEmployeeNotificationSetting = {
		payment: false,
		assignment: false,
		invitation: false,
		mention: false,
		comment: false,
		message: false,
		preferences: { taskUpdate: false }
	} as IEmployeeNotificationSetting;

	function serviceWith(setting: IEmployeeNotificationSetting | 'missing') {
		const settings = {
			findByEmployee: jest.fn(async () => {
				if (setting === 'missing') throw new NotFoundException();
				return setting;
			}),
			createForEmployee: jest.fn(async (input: IEmployeeNotificationSetting) => input)
		};
		const eventBus = { publish: jest.fn() };
		const service = new EmployeeNotificationService(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ metadata: { tableName: 'employee_notification', hasColumnWithPropertyPath: () => true } } as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{} as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			settings as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			eventBus as any
		);
		const saved = jest
			.spyOn(TenantAwareCrudService.prototype, 'create')
			.mockImplementation(async (input) => ({ id: 'notification-1', ...input }) as never);
		return { service, saved, eventBus, settings };
	}

	afterEach(() => jest.restoreAllMocks());

	it.each([
		EmployeeNotificationTypeEnum.PAYMENT,
		EmployeeNotificationTypeEnum.ASSIGNMENT,
		EmployeeNotificationTypeEnum.INVITATION,
		EmployeeNotificationTypeEnum.MENTION,
		EmployeeNotificationTypeEnum.COMMENT,
		EmployeeNotificationTypeEnum.MESSAGE,
		EmployeeNotificationTypeEnum.TASK_UPDATE
	])('saves a %s notification for a receiver who switched the kind off, and tells the listeners', async (type) => {
		const { service, saved, eventBus } = serviceWith(ALL_OFF);

		const notification = await service.create({ type, receiverEmployeeId: RECEIVER, organizationId: 'org', tenantId: 'ten' } as never);

		expect(notification).toMatchObject({ id: 'notification-1', type, receiverEmployeeId: RECEIVER });
		expect(saved).toHaveBeenCalledTimes(1);
		// The Inbox bridge and the real-time hint hear of it as of any other notification.
		expect(eventBus.publish).toHaveBeenCalledWith(expect.any(EmployeeNotificationCreatedEvent));
	});

	it('saves the notification of a receiver with no settings yet, and creates their settings with every kind on', async () => {
		const { service, saved, settings } = serviceWith('missing');

		await service.create({ type: EmployeeNotificationTypeEnum.COMMENT, receiverEmployeeId: RECEIVER, organizationId: 'org', tenantId: 'ten' } as never);

		expect(saved).toHaveBeenCalledTimes(1);
		expect(settings.createForEmployee).toHaveBeenCalledWith(expect.objectContaining({ comment: true, employeeId: RECEIVER }));
	});

	it('still refuses a type it does not know', async () => {
		const { service, saved } = serviceWith(ALL_OFF);

		await expect(
			service.create({ type: 'NotAType', receiverEmployeeId: RECEIVER, organizationId: 'org', tenantId: 'ten' } as never)
		).rejects.toBeInstanceOf(BadRequestException);
		expect(saved).not.toHaveBeenCalled();
	});
});
