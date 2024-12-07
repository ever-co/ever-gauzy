import { CommandBus, EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { ISubscription } from '@gauzy/contracts';
import { CreateSubscriptionEvent } from '../subscription.create.event';
import { SubscriptionCreateCommand } from '../../commands';

@EventsHandler(CreateSubscriptionEvent)
export class CreateSubscriptionHandler implements IEventHandler<CreateSubscriptionEvent> {
	constructor(private readonly commandBus: CommandBus) {}

	/**
	 * Handles the `CreateSubscriptionEvent` by delegating the subscription creation process to the appropriate command.
	 *
	 * @param {CreateSubscriptionEvent} event - The event object containing the subscription input data.
	 * @returns {Promise<ISubscription>} A promise that resolves to the created subscription.
	 *
	 */
	async handle(event: CreateSubscriptionEvent): Promise<ISubscription> {
		const { input } = event;
		return await this.commandBus.execute(new SubscriptionCreateCommand(input));
	}
}
