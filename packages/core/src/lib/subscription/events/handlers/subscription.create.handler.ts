import { CommandBus, EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { IEntitySubscription } from '@gauzy/contracts';
import { CreateSubscriptionEvent } from '../subscription.create.event';
import { SubscriptionCreateCommand } from '../../commands';

@EventsHandler(CreateSubscriptionEvent)
export class CreateSubscriptionHandler implements IEventHandler<CreateSubscriptionEvent> {
	constructor(private readonly commandBus: CommandBus) {}

	/**
	 * Handles a subscription creation event.
	 *
	 * Extracts subscription details from the event input and uses the command bus to execute a SubscriptionCreateCommand,
	 * which creates a new subscription for the specified entity.
	 *
	 * @param {CreateSubscriptionEvent} event - The event containing the input data for subscription creation.
	 * @returns {Promise<IEntitySubscription>} A promise that resolves to the created subscription.
	 * @throws An error if the subscription creation process fails.
	 */
	async handle(event: CreateSubscriptionEvent): Promise<IEntitySubscription> {
		try {
			// Retrieve the input data from the event.
			const { entity, entityId, userId, type, organizationId, tenantId } = event.input;

			// Execute the subscription creation command.
			const subscription = await this.commandBus.execute(
				new SubscriptionCreateCommand({
					entity,
					entityId,
					userId,
					type,
					organizationId,
					tenantId
				})
			);

			return subscription;
		} catch (error) {
			console.log(`Error while creating subscription: ${error.message}`, error);
		}
	}
}
