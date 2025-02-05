import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import {
	IUserNotification,
	IUserNotificationCreateInput,
	IUserNotificationSetting,
	NotificationActionTypeEnum,
	UserNotificationTypeEnum
} from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud';
import { RequestContext } from '../core/context';
import { UserNotificationEvent } from './events/user-notification.event';
import { UserNotification } from './user-notification.entity';
import { TypeOrmUserNotificationRepository } from './repository/type-orm-user-notification.repository';
import { MikroOrmUserNotificationRepository } from './repository/mikro-orm-user-notification.repository';
import { generateNotificationTitle } from './user-notification.helper';
import { UserNotificationSettingService } from './user-notification-setting/user-notification-setting.service';

@Injectable()
export class UserNotificationService extends TenantAwareCrudService<UserNotification> {
	constructor(
		readonly typeOrmUserNotificationRepository: TypeOrmUserNotificationRepository,
		readonly mikroOrmUserNotificationRepository: MikroOrmUserNotificationRepository,
		private readonly userNotificationSettingService: UserNotificationSettingService,
		private readonly _eventBus: EventBus
	) {
		super(typeOrmUserNotificationRepository, mikroOrmUserNotificationRepository);
	}

	/**
	 * Creates a new notification entry with the provided input, while associating it with the current tenant.
	 *
	 * @param input - The data required to create an notification entry.
	 * @returns The created notification entry.
	 * @throws BadRequestException when the log creation fails.
	 */
	async create(input: IUserNotificationCreateInput): Promise<IUserNotification> {
		try {
			// Retrieve the current tenant ID from the request context or use the provided tenantId
			const tenantId = RequestContext.currentTenantId() || input.tenantId;

			// Search for the receiver notification setting
			let userSetting: IUserNotificationSetting;
			try {
				userSetting = await this.userNotificationSettingService.findOneByWhereOptions({
					userId: input.receiverId,
					tenantId,
					organizationId: input.organizationId
				});
			} catch (error) {
				if (error instanceof NotFoundException) {
					userSetting = await this.userNotificationSettingService.create({
						userId: input.receiverId,
						assignment: true,
						comment: true,
						invitation: true,
						mention: true,
						message: true,
						payment: true,
						preferences: {
							email: true,
							inApp: true
						}
					});
				}
			}
			// Check if the receiver user has activated the notification for the current notification type
			const isAllowedNotification = this.shouldCreateUserNotification(userSetting, input.type);
			if (!isAllowedNotification) {
				return; // Do nothing if notification is not allowed
			}

			// Create the notification entry using the provided input along with the tenantId and return the created notification
			return await super.create({ ...input, tenantId });
		} catch (error) {
			console.log('Error while creating notification:', error);
			throw new BadRequestException('Error while creating notification', error);
		}
	}

	/**
	 * Marks all unread and unarchived notifications for the current user as read.
	 *
	 * @throws {BadRequestException} If an error occurs while updating notifications.
	 * @returns {Promise<any>} A promise that resolves when the operation is complete.
	 */
	async markAllAsRead(): Promise<any> {
		try {
			// Retrieve the current user ID
			const userId = RequestContext.currentUserId();

			const readAt = new Date();
			// Update all user's unread and un archived notifications
			return await super.update(
				{ isRead: false, isArchived: false, receiverId: userId },
				{ isRead: true, readAt }
			);
		} catch (error) {
			throw new BadRequestException('Error while updating notifications', error);
		}
	}

	/**
	 * Publishes a user notification event to create a new notification.
	 *
	 * @param input - The input data required to create the notification.
	 * @param actionType - The type of action that triggered the notification.
	 * @param entityName - The name of the entity related to the notification.
	 * @param userName - The name of the user related to the notification.
	 */
	publishNotificationEvent(
		input: IUserNotificationCreateInput,
		actionType: NotificationActionTypeEnum,
		entityName: string,
		userName: string
	) {
		// Emit the event to create the notification
		this._eventBus.publish(
			new UserNotificationEvent({
				...input,
				title: generateNotificationTitle(actionType, input.entity, entityName, userName)
			})
		);
	}

	/**
	 * Determines whether a user notification should be created based on the user's notification settings and the notification type.
	 *
	 * @param userNotificationSetting - The user's notification settings.
	 * @param type - The type of notification.
	 * @returns {boolean} True if a user notification should be created, false otherwise.
	 */
	private shouldCreateUserNotification(
		userNotificationSetting: IUserNotificationSetting,
		type: UserNotificationTypeEnum
	): boolean {
		switch (type) {
			case UserNotificationTypeEnum.PAYMENT:
				return userNotificationSetting.payment ?? true;
			case UserNotificationTypeEnum.ASSIGNMENT:
				return userNotificationSetting.assignment ?? true;
			case UserNotificationTypeEnum.INVITATION:
				return userNotificationSetting.invitation ?? true;
			case UserNotificationTypeEnum.MENTION:
				return userNotificationSetting.mention ?? true;
			case UserNotificationTypeEnum.COMMENT:
				return userNotificationSetting.comment ?? true;
			case UserNotificationTypeEnum.MESSAGE:
				return userNotificationSetting.message ?? true;
			default:
				return false;
		}
	}
}
