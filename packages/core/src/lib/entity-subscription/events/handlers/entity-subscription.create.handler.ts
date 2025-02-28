import { BadRequestException } from '@nestjs/common';
import { CommandBus, EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { IEntitySubscription } from '@gauzy/contracts';
import { CreateEntitySubscriptionEvent } from '../entity-subscription.create.event';
import { EntitySubscriptionCreateCommand } from '../../commands';

@EventsHandler(CreateEntitySubscriptionEvent)
export class CreateSubscriptionHandler implements IEventHandler<CreateEntitySubscriptionEvent> {
	constructor(private readonly commandBus: CommandBus) {}

	/**
	 * Handles a subscription creation event.
	 *
	 * Extracts subscription details from the event input and uses the command bus to execute a EntitySubscriptionCreateCommand,
	 * which creates a new subscription for the specified entity.
	 *
	 * @param {CreateEntitySubscriptionEvent} event - The event containing the input data for subscription creation.
	 * @returns {Promise<IEntitySubscription>} A promise that resolves to the created subscription.
	 * @throws An error if the subscription creation process fails.
	 */
	async handle(event: CreateEntitySubscriptionEvent): Promise<IEntitySubscription> {
		try {
			// Retrieve the input data from the event.
			const { entity, entityId, employeeId, type, organizationId, tenantId } = event.input;

			// Execute the subscription creation command.
			const subscription = await this.commandBus.execute(
				new EntitySubscriptionCreateCommand({
					entity,
					entityId,
					employeeId,
					type,
					organizationId,
					tenantId
				})
			);

			return subscription;
		} catch (error) {
			console.log(`Error while creating subscription: ${error.message}`, error);
			// Re-throw the error with additional context
			throw new BadRequestException('Failed to create subscription', error);
		}
	}
}
