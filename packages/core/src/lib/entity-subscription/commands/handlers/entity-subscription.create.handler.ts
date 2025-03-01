import { IEntitySubscription } from '@gauzy/contracts';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { EntitySubscriptionCreateCommand } from '../entity-subscription.create.command';
import { EntitySubscriptionService } from '../../entity-subscription.service';

@CommandHandler(EntitySubscriptionCreateCommand)
export class EntitySubscriptionCreateHandler implements ICommandHandler<EntitySubscriptionCreateCommand> {
	constructor(private readonly subscriptionService: EntitySubscriptionService) {}

	public async execute(command: EntitySubscriptionCreateCommand): Promise<IEntitySubscription> {
		const { input } = command;

		return await this.subscriptionService.create(input);
	}
}
