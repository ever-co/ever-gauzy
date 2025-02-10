import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { UserCreateNotificationEvent } from '../user-notification.event';
import { UserNotificationService } from '../../user-notification.service';

@EventsHandler(UserCreateNotificationEvent)
export class UserCreateNotificationEventHandler implements IEventHandler<UserCreateNotificationEvent> {
	constructor(readonly userNotificationService: UserNotificationService) {}

	/**
	 * Handles the user notification event by creating a new user notification entry using the provided input data.
	 *
	 * @param event - The user notification event containing the input data required to create the notification entry.
	 * @returns A promise that resolves with the created user notification entry.
	 *
	 */
	async handle(event: UserCreateNotificationEvent) {
		return await this.userNotificationService.create(event.input);
	}
}
