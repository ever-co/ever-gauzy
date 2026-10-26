import { Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { UserEmailChangedEvent } from '../../../user/events/user-email-changed.event';
import { EmailConfirmationService } from '../../email-confirmation.service';

/**
 * Sends the confirmation e-mail for a user's new address — the same message registration sends,
 * with the deployment's own links. Does nothing when e-mail verification is disabled (the service
 * checks the feature flag).
 */
@EventsHandler(UserEmailChangedEvent)
export class UserEmailChangedHandler implements IEventHandler<UserEmailChangedEvent> {
	private readonly logger = new Logger(UserEmailChangedHandler.name);

	constructor(private readonly emailConfirmationService: EmailConfirmationService) {}

	async handle({ user }: UserEmailChangedEvent): Promise<void> {
		try {
			await this.emailConfirmationService.sendEmailVerification(user, {});
		} catch (error) {
			this.logger.error(`Could not send the confirmation e-mail for user ${user?.id}: ${error?.message}`);
		}
	}
}
