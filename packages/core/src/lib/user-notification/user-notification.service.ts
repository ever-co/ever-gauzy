import { BadRequestException, Injectable } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { IUserNotification, IUserNotificationCreateInput, NotificationActionTypeEnum } from '@gauzy/contracts';
import { TenantAwareCrudService } from '../core/crud';
import { RequestContext } from '../core/context';
import { UserNotificationEvent } from './events/user-notification.event';
import { UserNotification } from './user-notification.entity';
import { TypeOrmUserNotificationRepository } from './repository/type-orm-user-notification.repository';
import { MikroOrmUserNotificationRepository } from './repository/mikro-orm-user-notification.repository';
import { generateNotificationTitle } from './user-notification.helper';

@Injectable()
export class UserNotificationService extends TenantAwareCrudService<UserNotification> {
	constructor(
		readonly typeOrmUserNotificationRepository: TypeOrmUserNotificationRepository,
		readonly mikroOrmUserNotificationRepository: MikroOrmUserNotificationRepository,
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

			// Create the notification entry using the provided input along with the tenantId and return the created notification
			return await super.create({ ...input, tenantId });
		} catch (error) {
			console.log('Error while creating notification:', error);
			throw new BadRequestException('Error while creating notification', error);
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
}
