import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import {
	IEmployeeNotification,
	IEmployeeNotificationCreateInput,
	IEmployeeNotificationSetting,
	NotificationActionTypeEnum,
	EmployeeNotificationTypeEnum,
	IMarkAllAsReadResponse
} from '@gauzy/contracts';
import { UpdateResult } from 'typeorm';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { RequestContext } from '../core/context/request-context';
import { EmployeeNotificationSettingService } from '../employee-notification-setting/employee-notification-setting.service';
import { EmployeeCreateNotificationEvent } from './events/employee-notification.event';
import { EmployeeNotification } from './employee-notification.entity';
import { TypeOrmEmployeeNotificationRepository } from './repository/type-orm-employee-notification.repository';
import { MikroOrmEmployeeNotificationRepository } from './repository/mikro-orm-employee-notification.repository';
import { generateNotificationTitle } from './employee-notification.helper';

@Injectable()
export class EmployeeNotificationService extends TenantAwareCrudService<EmployeeNotification> {
	readonly logger = new Logger(EmployeeNotificationService.name);

	constructor(
		readonly typeOrmEmployeeNotificationRepository: TypeOrmEmployeeNotificationRepository,
		readonly mikroOrmEmployeeNotificationRepository: MikroOrmEmployeeNotificationRepository,
		private readonly _employeeNotificationSettingService: EmployeeNotificationSettingService,
		private readonly _eventBus: EventBus
	) {
		super(typeOrmEmployeeNotificationRepository, mikroOrmEmployeeNotificationRepository);
	}

	/**
	 * Creates a new notification entry with the provided input, while associating it with the current tenant.
	 *
	 * @param input - The data required to create an notification entry.
	 * @returns The created notification entry.
	 * @throws BadRequestException when the log creation fails.
	 */
	async create(input: IEmployeeNotificationCreateInput): Promise<IEmployeeNotification | undefined> {
		try {
			// Retrieve the current tenant ID from the request context or use the provided tenantId
			const tenantId = RequestContext.currentTenantId() || input.tenantId;
			const organizationId = input.organizationId;
			const employeeId = input.receiverId;

			// Search for the receiver notification setting
			let employeeNotificationSetting: IEmployeeNotificationSetting;

			try {
				employeeNotificationSetting = await this._employeeNotificationSettingService.findOneByWhereOptions({
					employeeId,
					organizationId,
					tenantId
				});
			} catch (error) {
				if (error instanceof NotFoundException) {
					employeeNotificationSetting = await this._employeeNotificationSettingService.create({
						employeeId,
						assignment: true,
						comment: true,
						invitation: true,
						mention: true,
						message: true,
						payment: true,
						preferences: { email: true, inApp: true },
						organizationId,
						tenantId
					});
				}
			}

			// Check if the receiver employee has activated the notification for the current notification type
			const isAllowedNotification = this.shouldCreateEmployeeNotification(
				employeeNotificationSetting,
				input.type
			);

			if (!isAllowedNotification) {
				return undefined; // Do nothing if notification is not allowed
			}

			// Create the notification entry using the provided input along with the tenantId and return the created notification
			return await super.create({ ...input, tenantId });
		} catch (error) {
			this.logger.error('Error while creating employee notification:', error);
			throw new BadRequestException('Error while creating notification', error);
		}
	}

	/**
	 * Marks all unread and un-archived notifications for the current employee as read.
	 *
	 * @throws {BadRequestException} If an error occurs while updating notifications.
	 * @returns {Promise<{ success: boolean; count: number }>} A promise that resolves to an object indicating the success status and the count of notifications updated.
	 */
	async markAllAsRead(): Promise<IMarkAllAsReadResponse> {
		try {
			// Retrieve the current employee ID
			const receiverId = RequestContext.currentEmployeeId();

			// Update all unread and unarchived notifications for the current employee
			// Assume super.update returns an object with an "affected" property that represents the number of records updated.
			const updateResult = (await super.update(
				{ isRead: false, isArchived: false, receiverId },
				{ isRead: true, readAt: new Date() }
			)) as UpdateResult;

			// Extract the count of notifications that were updated.
			const count = updateResult?.affected || 0;

			return { success: true, count };
		} catch (error) {
			throw new BadRequestException('Error while updating notifications', error);
		}
	}

	/**
	 * Publishes a employee notification event to create a new notification.
	 *
	 * @param input - The input data required to create the notification.
	 * @param actionType - The type of action that triggered the notification.
	 * @param entityName - The name of the entity related to the notification.
	 * @param employeeName - The name of the employee related to the notification.
	 */
	publishNotificationEvent(
		input: IEmployeeNotificationCreateInput,
		actionType: NotificationActionTypeEnum,
		entityName: string,
		employeeName: string
	): void {
		// Emit the event to create the notification
		this._eventBus.publish(
			new EmployeeCreateNotificationEvent({
				...input,
				title: generateNotificationTitle(actionType, input.entity, entityName, employeeName)
			})
		);
	}

	/**
	 * Determines whether a employee notification should be created based on the employee's notification settings and the notification type.
	 *
	 * @param employeeNotificationSetting - The employee's notification settings.
	 * @param type - The type of notification.
	 * @returns {boolean} True if a employee notification should be created, false otherwise.
	 */
	private shouldCreateEmployeeNotification(
		employeeNotificationSetting: IEmployeeNotificationSetting,
		type: EmployeeNotificationTypeEnum
	): boolean {
		switch (type) {
			case EmployeeNotificationTypeEnum.PAYMENT:
				return employeeNotificationSetting.payment ?? true;
			case EmployeeNotificationTypeEnum.ASSIGNMENT:
				return employeeNotificationSetting.assignment ?? true;
			case EmployeeNotificationTypeEnum.INVITATION:
				return employeeNotificationSetting.invitation ?? true;
			case EmployeeNotificationTypeEnum.MENTION:
				return employeeNotificationSetting.mention ?? true;
			case EmployeeNotificationTypeEnum.COMMENT:
				return employeeNotificationSetting.comment ?? true;
			case EmployeeNotificationTypeEnum.MESSAGE:
				return employeeNotificationSetting.message ?? true;
			default:
				throw new Error(`Unsupported notification type: ${type}`);
		}
	}
}
