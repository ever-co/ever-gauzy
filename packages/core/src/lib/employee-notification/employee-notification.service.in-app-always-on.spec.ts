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
		preferences: { taskUpdate: false, timerReminderHours: null, taskDueReminderHours: null }
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
		EmployeeNotificationTypeEnum.TASK_UPDATE,
		EmployeeNotificationTypeEnum.TIMER_REMINDER,
		EmployeeNotificationTypeEnum.INVOICE,
		EmployeeNotificationTypeEnum.MEETING,
		EmployeeNotificationTypeEnum.TASK_DUE_REMINDER,
		EmployeeNotificationTypeEnum.BOARD_SHARE,
		EmployeeNotificationTypeEnum.BOARD_MENTION
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

	it('saves the notification when another one created the receiver\'s settings first (the insert loses the race)', async () => {
		const { service, saved, settings } = serviceWith('missing');
		const winner = { ...ALL_OFF, comment: true } as IEmployeeNotificationSetting;
		settings.createForEmployee.mockRejectedValueOnce(new Error('duplicate key value violates unique constraint'));
		settings.findByEmployee.mockRejectedValueOnce(new NotFoundException()).mockResolvedValueOnce(winner);

		await expect(
			service.create({ type: EmployeeNotificationTypeEnum.COMMENT, receiverEmployeeId: RECEIVER, organizationId: 'org', tenantId: 'ten' } as never)
		).resolves.toMatchObject({ id: 'notification-1' });
		expect(saved).toHaveBeenCalledTimes(1);
		expect(settings.findByEmployee).toHaveBeenCalledTimes(2);
	});

	it('saves the notification when the receiver\'s settings can be neither read nor created', async () => {
		const { service, saved, settings } = serviceWith('missing');
		settings.findByEmployee.mockRejectedValue(new Error('connection reset'));

		await expect(
			service.create({ type: EmployeeNotificationTypeEnum.MENTION, receiverEmployeeId: RECEIVER, organizationId: 'org', tenantId: 'ten' } as never)
		).resolves.toMatchObject({ id: 'notification-1' });
		expect(saved).toHaveBeenCalledTimes(1);
		expect(settings.createForEmployee).not.toHaveBeenCalled();
	});

	it('still refuses a type it does not know', async () => {
		const { service, saved } = serviceWith(ALL_OFF);

		await expect(
			service.create({ type: 'NotAType', receiverEmployeeId: RECEIVER, organizationId: 'org', tenantId: 'ten' } as never)
		).rejects.toBeInstanceOf(BadRequestException);
		expect(saved).not.toHaveBeenCalled();
	});
});

/**
 * A notification can carry what must not reach the application log (a Board's link holds its encryption key in its
 * `#` part): a failed insert is logged as the statement and the driver's answer, never with the values it bound.
 */
describe('EmployeeNotificationService.create — a failed insert', () => {
	it('is logged without the values it bound, and refused', async () => {
		const service = new EmployeeNotificationService(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ metadata: { tableName: 'employee_notification', hasColumnWithPropertyPath: () => true } } as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{} as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ findByEmployee: jest.fn(async () => ({})) } as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			{ publish: jest.fn() } as any
		);
		const link = 'https://boards.example/#room=r00m,secret-key';
		jest.spyOn(TenantAwareCrudService.prototype, 'create').mockRejectedValue(
			Object.assign(new Error('value too long for type character varying(255)'), {
				name: 'QueryFailedError',
				query: 'INSERT INTO "employee_notification" …',
				parameters: ['Ana shared a Board with you', JSON.stringify({ board: { roomId: 'r00m', link } })],
				driverError: { code: '22001' }
			})
		);
		const logged = jest.spyOn(service.logger, 'error').mockImplementation(() => undefined);

		await expect(
			service.create({
				type: EmployeeNotificationTypeEnum.BOARD_SHARE,
				receiverEmployeeId: 'employee-receiver',
				organizationId: 'org',
				tenantId: 'ten',
				metadata: { board: { roomId: 'r00m', link } }
			} as never)
		).rejects.toBeInstanceOf(BadRequestException);

		expect(logged).toHaveBeenCalled();
		expect(JSON.stringify(logged.mock.calls)).not.toContain('secret-key');
		jest.restoreAllMocks();
	});
});
